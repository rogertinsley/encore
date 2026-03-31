import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clients } from "@/lib/clients";
import { filterPlaceholder } from "@/lib/lastfm/utils";

export async function GET() {
  const [releases, recommendations, recentTracks] = await Promise.allSettled([
    prisma.newRelease.findMany({
      orderBy: [{ releaseDate: "desc" }, { playCount: "desc" }],
      take: 20,
    }),
    prisma.recommendation.findMany({
      orderBy: { score: "desc" },
      take: 12,
    }),
    clients.lastfm.getRecentTracks(process.env.LASTFM_USERNAME ?? "", 15),
  ]);

  return NextResponse.json({
    releases: releases.status === "fulfilled" ? releases.value : [],
    recommendations:
      recommendations.status === "fulfilled" ? recommendations.value : [],
    recentTracks:
      recentTracks.status === "fulfilled"
        ? recentTracks.value.map((t) => ({
            ...t,
            albumArtUrl: filterPlaceholder(t.albumArtUrl),
            scrobbledAt: t.scrobbledAt?.toISOString() ?? null,
          }))
        : [],
  });
}
