import { clients } from "@/lib/clients";
import { NewReleasesService } from "@/lib/new-releases/service";
import { prisma } from "@/lib/prisma";
import { startJob, isStale } from "@/lib/jobs/runner";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

function sinceDate(): Date {
  const days = parseInt(process.env.NEW_RELEASES_DAYS_WINDOW ?? "90", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

async function runNewReleasesJob(): Promise<void> {
  const latest = await prisma.newRelease.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!isStale(latest?.createdAt ?? null)) return;

  console.log("[NewReleasesJob] running…");

  const { lastfm, musicBrainz, coverArt } = clients;
  const service = new NewReleasesService(lastfm, musicBrainz);

  const releases = await service.getNewReleases(
    process.env.LASTFM_USERNAME ?? "",
    sinceDate()
  );

  // Fetch cover art in parallel for all releases
  const coverArtUrls = await Promise.all(
    releases.map((r) =>
      r.mbid
        ? coverArt.getAlbumArtByReleaseGroup(r.mbid).catch(() => null)
        : Promise.resolve(null)
    )
  );

  await prisma.$transaction([
    prisma.newRelease.deleteMany(),
    prisma.newRelease.createMany({
      data: releases.map((r, i) => ({
        artistName: r.artistName,
        title: r.title,
        releaseDate: new Date(r.date),
        releaseType: r.type,
        mbid: r.mbid || undefined,
        coverArtUrl: coverArtUrls[i],
        playCount: r.playCount,
      })),
      skipDuplicates: true,
    }),
  ]);

  console.log(`[NewReleasesJob] saved ${releases.length} releases`);
}

export function startNewReleasesJob(): void {
  startJob("NewReleasesJob", JOB_INTERVAL_MS, runNewReleasesJob);
}
