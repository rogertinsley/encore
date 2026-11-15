import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clients } from "@/lib/clients";
import { normalizeTrack } from "@/lib/lastfm/transforms";
import { getReleaseProgress } from "@/lib/lidarr/progress";

export async function GET() {
  const [releases, recommendations, recentTracks, lidarrAlbums] =
    await Promise.allSettled([
      prisma.newRelease.findMany({
        orderBy: [{ releaseDate: "desc" }, { playCount: "desc" }],
        take: 20,
      }),
      prisma.recommendation.findMany({
        orderBy: { score: "desc" },
        take: 12,
      }),
      clients.lastfm.getRecentTracks(process.env.LASTFM_USERNAME ?? "", 15),
      getReleaseProgress(),
    ]);

  const albums =
    lidarrAlbums.status === "fulfilled" ? lidarrAlbums.value : null;

  return NextResponse.json({
    lidarrConfigured: Boolean(process.env.LIDARR_API_KEY),
    releases:
      releases.status === "fulfilled"
        ? releases.value.map((release) => ({
            ...release,
            lidarrStatus: albums ? albums(release.mbid) : null,
          }))
        : [],
    recommendations:
      recommendations.status === "fulfilled" ? recommendations.value : [],
    recentTracks:
      recentTracks.status === "fulfilled"
        ? recentTracks.value.map(normalizeTrack)
        : [],
  });
}
