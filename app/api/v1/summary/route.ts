import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { clients } from "@/lib/clients";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import { normalizeTrack } from "@/lib/lastfm/transforms";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

export async function GET() {
  const [
    nowPlayingResult,
    historyResult,
    recommendationsResult,
    releasesResult,
  ] = await Promise.allSettled([
    redis.get(NOW_PLAYING_KEY),
    clients.lastfm.getRecentTracks(process.env.LASTFM_USERNAME ?? "", 50),
    prisma.recommendation.findMany({ orderBy: { score: "desc" }, take: 50 }),
    prisma.newRelease.findMany({
      orderBy: [{ releaseDate: "desc" }, { playCount: "desc" }],
    }),
  ]);

  const nowPlaying: EnrichedNowPlaying | null =
    nowPlayingResult.status === "fulfilled" && nowPlayingResult.value
      ? JSON.parse(nowPlayingResult.value)
      : null;

  const history =
    historyResult.status === "fulfilled"
      ? historyResult.value.map(normalizeTrack)
      : [];

  const recommendations =
    recommendationsResult.status === "fulfilled"
      ? recommendationsResult.value
      : [];

  const releases =
    releasesResult.status === "fulfilled" ? releasesResult.value : [];

  return NextResponse.json({
    nowPlaying,
    history,
    recommendations: {
      items: recommendations,
      lastRunAt: recommendations[0]?.createdAt ?? null,
    },
    newReleases: {
      items: releases,
      lastRunAt: releases[0]?.createdAt ?? null,
    },
  });
}
