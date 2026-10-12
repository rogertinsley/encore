"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type LidarrStatus =
  | "not-tracked"
  | "unmonitored"
  | "monitored"
  | "partial"
  | "downloaded"
  | null;
interface ShelfItem {
  id: string;
  kind: "track" | "release";
  artistName: string;
  title: string;
  albumName: string | null;
  coverArtUrl: string | null;
  source: string | null;
  savedAt: string;
  lidarrStatus: LidarrStatus;
  canAdd: boolean;
}

const statusText: Record<Exclude<LidarrStatus, null>, string> = {
  "not-tracked": "Not in Lidarr",
  unmonitored: "In Lidarr · not monitored",
  monitored: "Monitored in Lidarr",
  partial: "Partly downloaded",
  downloaded: "In your library",
};

export function ShelfView() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "track" | "release">("all");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/shelf", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load your Shelf");
    setItems(await response.json());
  }, []);
  useEffect(() => {
    refresh()
      .catch(() => setError("Could not load your Shelf"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const action = async (
    item: ShelfItem,
    operation: "remove" | "monitor" | "add"
  ) => {
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(
        operation === "remove"
          ? `/api/shelf/${item.id}`
          : `/api/shelf/${item.id}/lidarr`,
        {
          method: operation === "remove" ? "DELETE" : "POST",
          headers:
            operation === "remove"
              ? undefined
              : { "Content-Type": "application/json" },
          body:
            operation === "remove"
              ? undefined
              : JSON.stringify({ action: operation }),
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Action failed");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };
  const shown = items.filter(
    (item) => filter === "all" || item.kind === filter
  );

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <header className="relative overflow-hidden border-b border-warm-700/70 pb-8 pt-8 sm:pt-12">
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.3em] text-amber-accent">
          Encore collection
        </p>
        <h1 className="font-display text-5xl font-light tracking-tight text-warm-100 sm:text-7xl">
          The Listening Shelf
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-warm-400 sm:text-base">
          Music worth returning to. Keep a track from the display or save a
          release from Discover, then decide what belongs in Lidarr.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 py-7">
        <div className="flex gap-2" aria-label="Filter Shelf">
          {(["all", "track", "release"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-4 py-2 text-xs capitalize transition-colors ${filter === value ? "border-amber-accent/70 bg-amber-accent/10 text-warm-100" : "border-warm-700 text-warm-400 hover:text-warm-100"}`}
            >
              {value === "all"
                ? "All"
                : value === "track"
                  ? "Tracks"
                  : "Releases"}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-warm-500">
          {shown.length} {shown.length === 1 ? "item" : "items"}
        </span>
      </div>
      {error && (
        <p
          className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
          role="status"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-20 text-center text-warm-500">Loading your Shelf…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-warm-700/50 bg-warm-800/30 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-accent/30 text-4xl text-amber-accent">
            ♫
          </div>
          <h2 className="font-display text-3xl text-warm-100">
            A space for the next favourite.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-warm-400">
            Tap “Keep this” on the Display or save a new release in Discover. It
            will be here when you return.
          </p>
          <Link
            href="/discover"
            className="mt-7 inline-block rounded-full border border-amber-accent/60 px-5 py-3 text-sm text-warm-100 hover:bg-amber-accent/10"
          >
            Explore new releases
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => (
            <article
              key={item.id}
              className="group flex min-w-0 gap-4 rounded-xl border border-warm-700/60 bg-warm-800/40 p-3 transition-colors hover:border-warm-600"
            >
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-warm-800 sm:h-32 sm:w-32">
                {item.coverArtUrl ? (
                  <Image
                    src={item.coverArtUrl}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl text-warm-600">
                    ♪
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-amber-accent">
                  {item.kind === "track" ? "Saved track" : "New release"}
                </span>
                <h2
                  className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-warm-100"
                  title={item.title}
                >
                  {item.title}
                </h2>
                <Link
                  href={`/artist/${encodeURIComponent(item.artistName)}`}
                  className="mt-1 truncate text-xs text-warm-400 hover:text-warm-100"
                >
                  {item.artistName}
                </Link>
                {item.kind === "track" && item.albumName && (
                  <p className="truncate text-xs text-warm-500">
                    {item.albumName}
                  </p>
                )}
                <p className="mt-auto pt-2 text-[0.68rem] text-warm-500">
                  {item.lidarrStatus === null
                    ? "Lidarr status unavailable"
                    : !item.albumName
                      ? "Album unknown"
                      : statusText[item.lidarrStatus]}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {item.lidarrStatus === "unmonitored" && (
                    <button
                      disabled={busy === item.id}
                      onClick={() => void action(item, "monitor")}
                      className="text-xs text-amber-accent hover:text-warm-100 disabled:opacity-50"
                    >
                      Monitor in Lidarr
                    </button>
                  )}
                  {item.lidarrStatus === "not-tracked" && item.canAdd && (
                    <button
                      disabled={busy === item.id}
                      onClick={() => void action(item, "add")}
                      className="text-xs text-amber-accent hover:text-warm-100 disabled:opacity-50"
                    >
                      Add to Lidarr
                    </button>
                  )}
                  <button
                    disabled={busy === item.id}
                    onClick={() => void action(item, "remove")}
                    className="text-xs text-warm-500 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
