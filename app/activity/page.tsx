import type { Metadata } from "next";
import { LIDARR_WEB_URL, lidarrRequest } from "@/lib/lidarr/releases";
import { redis } from "@/lib/redis";

export const metadata: Metadata = { title: "Lidarr Activity · Encore" };
export const dynamic = "force-dynamic";

interface WeeklyRun {
  finishedAt: string;
  failed: boolean;
  added: string[];
  addedArtists?: string[];
  searched: string[];
  issues: string[];
  commandId?: number;
}

interface Command {
  id: number;
  name: string;
  status: string;
  message?: string;
  body?: { artistId?: number; albumIds?: number[] };
}

interface QueueItem {
  id: number;
  title: string;
  trackedDownloadState?: string;
  status: string;
  errorMessage?: string;
  statusMessages?: { title: string; messages: string[] }[];
}

interface Import {
  id: number;
  sourceTitle: string;
  date: string;
}

const heading = "font-display text-2xl text-warm-100";
const panel = "border-t border-warm-700 py-6";
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function dateLabel(date: string) {
  return dateFormat.format(new Date(date)) + " UTC";
}

function stateLabel(state: string) {
  return state.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default async function ActivityPage() {
  const [weekly, queue, history, commands, artists] = await Promise.allSettled([
    redis
      .get("lidarr:weekly-release-run")
      .then((raw) => (raw ? (JSON.parse(raw) as WeeklyRun) : null)),
    lidarrRequest(
      "api/v1/queue?page=1&pageSize=50&includeUnknownArtistItems=true"
    ) as Promise<{ records: QueueItem[]; totalRecords: number }>,
    lidarrRequest(
      "api/v1/history?page=1&pageSize=12&eventType=8&sortKey=date&sortDirection=descending"
    ) as Promise<{ records: Import[] }>,
    lidarrRequest("api/v1/command") as Promise<Command[]>,
    lidarrRequest("api/v1/artist") as Promise<
      { id: number; artistName: string }[]
    >,
  ]);
  const run = weekly.status === "fulfilled" ? weekly.value : null;
  const weeklyCommand = run?.commandId
    ? await (
        lidarrRequest("api/v1/command/" + run.commandId) as Promise<Command>
      ).catch(() => null)
    : null;
  const searches =
    commands.status === "fulfilled"
      ? commands.value
          .filter((command) =>
            ["AlbumSearch", "MissingAlbumSearch", "ArtistSearch"].includes(
              command.name
            )
          )
          .slice(0, 12)
      : [];
  const artistNames = new Map(
    artists.status === "fulfilled"
      ? artists.value.map((artist) => [artist.id, artist.artistName])
      : []
  );
  const queueItems = queue.status === "fulfilled" ? queue.value.records : [];
  const imports = history.status === "fulfilled" ? history.value.records : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl font-light text-warm-100 sm:text-6xl">
          Lidarr Activity
        </h1>
        <a
          href={LIDARR_WEB_URL + "/activity/queue"}
          className="text-sm text-amber-accent hover:underline"
        >
          Open Lidarr queue ↗
        </a>
      </div>

      <section className="mb-10 border-y border-warm-700 py-6">
        <h2 className={heading}>Weekly release sync</h2>
        <p className="mt-2 text-sm text-warm-400">
          {weekly.status === "rejected"
            ? "Run history unavailable."
            : run
              ? dateLabel(run.finishedAt)
              : "No run recorded yet."}
          {run && (run.failed ? " · Finished with errors" : " · Finished")}
        </p>
        {run && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
              {[
                [run.addedArtists?.length ?? 0, "Artists added"],
                [run.added.length, "Releases added"],
                [
                  run.searched.length,
                  run.commandId ? "Sent for search" : "Selected for search",
                ],
                [run.issues.length, "Issues"],
              ].map(([count, label]) => (
                <div key={label} className="border-l border-warm-700 pl-4">
                  <div className="font-display text-3xl text-amber-accent">
                    {count}
                  </div>
                  <div className="text-sm text-warm-400">{label}</div>
                </div>
              ))}
            </div>
            {run.commandId && (
              <p className="mt-4 text-sm text-warm-300">
                Search {run.commandId} ·{" "}
                {weeklyCommand
                  ? stateLabel(weeklyCommand.status)
                  : "Status unavailable"}
                {weeklyCommand?.message ? " · " + weeklyCommand.message : ""}
              </p>
            )}
            {(
              [
                ["Artists added and sent for search", run.addedArtists ?? []],
                ["Releases added", run.added],
                ["Search targets", run.searched],
                ["Issues", run.issues],
              ] as const
            )
              .filter(([, items]) => items.length)
              .map(([label, items]) => (
                <details key={label} className="mt-3 text-sm text-warm-300">
                  <summary className="cursor-pointer">{label}</summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </details>
              ))}
          </>
        )}
      </section>

      <div className="grid gap-x-10 lg:grid-cols-[3fr_2fr]">
        <section className={panel}>
          <h2 className={heading}>Download queue</h2>
          {!queueItems.length && (
            <p className="mt-3 text-sm text-warm-400">
              {queue.status === "rejected"
                ? "Lidarr queue unavailable."
                : "No downloads in the queue."}
            </p>
          )}
          {queue.status === "fulfilled" &&
            queue.value.totalRecords > queueItems.length && (
              <p className="mt-2 text-sm text-warm-400">
                Showing {queueItems.length} of {queue.value.totalRecords}{" "}
                entries.
              </p>
            )}
          <ul className="mt-3 divide-y divide-warm-700">
            {queueItems.map((item) => {
              const reasons = [
                ...new Set(
                  [
                    item.errorMessage,
                    ...(item.statusMessages ?? []).flatMap((entry) =>
                      entry.messages.length ? entry.messages : [entry.title]
                    ),
                  ].filter(Boolean)
                ),
              ];
              return (
                <li key={item.id} className="py-3">
                  <p className="break-words text-sm text-warm-100">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs capitalize text-amber-accent">
                    {stateLabel(item.trackedDownloadState || item.status)}
                  </p>
                  {reasons.length > 0 && (
                    <details className="mt-2 text-sm text-warm-400">
                      <summary className="cursor-pointer">{reasons[0]}</summary>
                      {reasons.length > 1 && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {reasons.slice(1).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="min-w-0">
          <section className={panel}>
            <h2 className={heading}>Recent searches</h2>
            {!searches.length && (
              <p className="mt-3 text-sm text-warm-400">
                {commands.status === "rejected"
                  ? "Lidarr searches unavailable."
                  : "No recent search commands."}
              </p>
            )}
            <ul className="mt-3 divide-y divide-warm-700">
              {searches.map((command) => (
                <li key={command.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {artistNames.get(command.body?.artistId ?? 0) ??
                        (command.body?.albumIds?.length
                          ? command.body.albumIds.length + " album search"
                          : "Search " + command.id)}
                    </span>
                    <span className="capitalize text-amber-accent">
                      {stateLabel(command.status)}
                    </span>
                  </div>
                  {command.message && (
                    <p className="mt-1 break-words text-warm-400">
                      {command.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className={panel}>
            <h2 className={heading}>Recent imports</h2>
            {!imports.length && (
              <p className="mt-3 text-sm text-warm-400">
                {history.status === "rejected"
                  ? "Lidarr history unavailable."
                  : "No recent imports."}
              </p>
            )}
            <ul className="mt-3 divide-y divide-warm-700">
              {imports.map((entry) => (
                <li key={entry.id} className="py-3 text-sm">
                  <p className="break-words">{entry.sourceTitle}</p>
                  <time dateTime={entry.date} className="text-xs text-warm-400">
                    {dateLabel(entry.date)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
