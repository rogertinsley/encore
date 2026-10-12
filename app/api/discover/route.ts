import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clients } from "@/lib/clients";
import { normalizeTrack } from "@/lib/lastfm/transforms";
import { getLidarrAlbums, statusForRelease } from "@/lib/lidarr/releases";

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
      getLidarrAlbums(),
    ]);

  const albums =
    lidarrAlbums.status === "fulfilled" ? lidarrAlbums.value : null;

  return NextResponse.json({
    releases:
      releases.status === "fulfilled"
        ? releases.value.map((release) => ({
            ...release,
            lidarrStatus: albums
              ? statusForRelease(release.mbid, albums)
              : null,
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
