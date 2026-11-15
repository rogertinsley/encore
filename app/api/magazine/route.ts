import { NextResponse } from "next/server";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import { getRecentListening } from "@/lib/lastfm/recent-snapshot";
import { getLidarrArtists } from "@/lib/lidarr/artists";
import { getReleaseProgress } from "@/lib/lidarr/progress";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sameName } from "@/lib/shelf";

interface WeeklyRun {
  finishedAt: string;
  added: string[];
  searched: string[];
  addedArtists?: string[];
  failed: boolean;
  commandId?: number;
}

async function getReleases() {
  const now = new Date();
  const [released, upcoming] = await Promise.all([
    prisma.newRelease.findMany({
      where: { releaseDate: { lte: now } },
      orderBy: [{ releaseDate: "desc" }, { playCount: "desc" }],
      take: 16,
    }),
    prisma.newRelease.findMany({
      where: { releaseDate: { gt: now } },
      orderBy: [{ releaseDate: "asc" }, { playCount: "desc" }],
      take: 4,
    }),
  ]);
  return [...released, ...upcoming];
}

async function readMagazine() {
  const lidarrConfigured = Boolean(process.env.LIDARR_API_KEY);
  const [releases, recommendations, recent, albums, artists, current, weekly] =
    await Promise.allSettled([
      getReleases(),
      prisma.recommendation.findMany({
        orderBy: { score: "desc" },
        take: 50,
      }),
      getRecentListening(8),
      getReleaseProgress(),
      getLidarrArtists(),
      redis.get(NOW_PLAYING_KEY),
      redis.get("lidarr:weekly-release-run"),
    ]);

  const library = albums.status === "fulfilled" ? albums.value : null;
  const artistLibrary =
    artists.status === "fulfilled" && Array.isArray(artists.value)
      ? artists.value
      : null;
  const artistTracked = (name: string) =>
    artistLibrary?.some((artist) => sameName(artist.artistName, name)) ?? null;
  const picks =
    recommendations.status === "fulfilled"
      ? recommendations.value
          .map((recommendation) => ({
            id: recommendation.id,
            artistName: recommendation.artistName,
            sourceArtist: recommendation.sourceArtist,
            score: recommendation.score,
            tags: recommendation.tags,
            lidarrTracked: artistTracked(recommendation.artistName),
          }))
          .sort(
            (left, right) =>
              Number(left.lidarrTracked === true) -
              Number(right.lidarrTracked === true)
          )
          .slice(0, 12)
      : [];
  const track = parseRedis<EnrichedNowPlaying>(current);
  const run = parseRedis<WeeklyRun>(weekly);

  return {
    lidarrConfigured,
    releases:
      releases.status === "fulfilled"
        ? releases.value.map((release) => ({
            id: release.id,
            mbid: release.mbid,
            artistName: release.artistName,
            title: release.title,
            releaseDate: release.releaseDate.toISOString(),
            releaseType: release.releaseType,
            coverArtUrl: release.coverArtUrl,
            playCount: release.playCount,
            artistTracked: artistTracked(release.artistName),
            lidarrStatus:
              library && release.mbid ? library(release.mbid) : null,
          }))
        : [],
    recommendations: picks,
    weeklyRun:
      run &&
      Number.isFinite(Date.parse(run.finishedAt)) &&
      Array.isArray(run.added) &&
      Array.isArray(run.searched)
        ? {
            finishedAt: run.finishedAt,
            added: run.added.length,
            searched: run.commandId ? run.searched.length : 0,
            addedArtists: Array.isArray(run.addedArtists)
              ? run.addedArtists.length
              : 0,
            failed: run.failed === true,
          }
        : null,
    nowPlaying:
      track?.artistName && track.trackName
        ? {
            artistName: track.artistName,
            trackName: track.trackName,
            albumName: track.albumName,
            albumArtUrl: track.albumArtUrl,
            source: track.source,
            playState: track.playState,
          }
        : null,
    recentTracks: recent.status === "fulfilled" ? recent.value : [],
  };
}

function parseRedis<T>(result: PromiseSettledResult<string | null>): T | null {
  if (result.status !== "fulfilled" || !result.value) return null;
  try {
    return JSON.parse(result.value) as T;
  } catch {
    return null;
  }
}

export type MagazineData = Awaited<ReturnType<typeof readMagazine>>;

export async function GET() {
  return NextResponse.json(await readMagazine(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
