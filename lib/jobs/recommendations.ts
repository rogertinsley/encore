import { clients } from "@/lib/clients";
import { recommend } from "@/lib/recommendations/engine";
import { prisma } from "@/lib/prisma";
import { startJob, isStale } from "@/lib/jobs/runner";

const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STALENESS_HOURS = 20;
const MAX_ARTISTS = 20;

async function runRecommendationsJob(): Promise<void> {
  const latest = await prisma.recommendation.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!isStale(latest?.createdAt ?? null, STALENESS_HOURS)) return;

  console.log("[RecommendationsJob] running…");

  const { lastfm } = clients;
  const username = process.env.LASTFM_USERNAME ?? "";

  const [topArtists, userTopTags] = await Promise.all([
    lastfm.getTopArtists(username, "overall"),
    lastfm.getTopTags(username),
  ]);

  const slice = topArtists.slice(0, MAX_ARTISTS);

  // Fetch similar artists and tags per artist in parallel — avoids index-aligned arrays.
  const enriched = await Promise.all(
    slice.map(async (artist) => {
      const [similar, info] = await Promise.all([
        lastfm.getSimilarArtists(artist.name).catch(() => []),
        lastfm.getArtistInfo(artist.name).catch(() => null),
      ]);
      return { artist: { ...artist, tags: info?.tags ?? [] }, similar };
    })
  );

  const topArtistsWithTags = enriched.map((e) => e.artist);
  const similarArtistsMap = Object.fromEntries(
    enriched.map((e) => [e.artist.name, e.similar])
  );

  const recommendations = recommend({
    topArtists: topArtistsWithTags,
    similarArtistsMap,
    userTopTags: userTopTags.map((t) => t.name),
  });

  await prisma.$transaction([
    prisma.recommendation.deleteMany(),
    prisma.recommendation.createMany({
      data: recommendations.slice(0, 50).map((r) => ({
        artistName: r.artistName,
        sourceArtist: r.sourceArtist,
        score: r.score,
        tags: r.matchingTags,
      })),
    }),
  ]);

  console.log(
    `[RecommendationsJob] saved ${recommendations.length} recommendations`
  );
}

export function startRecommendationsJob(): void {
  startJob("RecommendationsJob", JOB_INTERVAL_MS, runRecommendationsJob);
}
