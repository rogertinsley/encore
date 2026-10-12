import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import {
  getLidarrAlbums,
  findShelfAlbum,
  statusForRelease,
} from "@/lib/lidarr/releases";
import { isSameOrigin } from "@/lib/request-origin";
import { shelfFingerprint } from "@/lib/shelf";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import { trackIdentity } from "@/lib/display/playback";

export async function GET() {
  try {
    const [items, albums] = await Promise.all([
      prisma.listeningShelfItem.findMany({ orderBy: { savedAt: "desc" } }),
      getLidarrAlbums(),
    ]);
    return NextResponse.json(
      items.map((item) => {
        const album = albums ? findShelfAlbum(albums, item) : undefined;
        return {
          ...item,
          lidarrStatus: albums
            ? album
              ? statusForRelease(album.foreignAlbumId ?? null, albums)
              : "not-tracked"
            : null,
          canAdd: Boolean(albums && !album && item.releaseGroupMbid),
        };
      })
    );
  } catch {
    return NextResponse.json({ error: "Shelf unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "cross-origin request" },
      { status: 403 }
    );
  let body: {
    source?: string;
    releaseId?: string;
    expectedTrackIdentity?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    if (body.source === "now-playing") {
      const raw = await redis.get(NOW_PLAYING_KEY);
      const track = raw ? (JSON.parse(raw) as EnrichedNowPlaying) : null;
      if (!track?.trackName || !track.artistName)
        return NextResponse.json(
          { error: "No track is playing" },
          { status: 409 }
        );
      if (body.expectedTrackIdentity !== trackIdentity(track))
        return NextResponse.json(
          { error: "Track changed. Please try again." },
          { status: 409 }
        );
      const fingerprint = shelfFingerprint(
        "track",
        track.artistName,
        track.trackName,
        track.albumName,
        null
      );
      const item = await prisma.listeningShelfItem.upsert({
        where: { fingerprint },
        update: { coverArtUrl: track.albumArtUrl, source: track.source },
        create: {
          fingerprint,
          kind: "track",
          artistName: track.artistName,
          title: track.trackName,
          albumName: track.albumName,
          coverArtUrl: track.albumArtUrl,
          source: track.source,
        },
      });
      return NextResponse.json(item);
    }
    if (body.source === "release" && typeof body.releaseId === "string") {
      const release = await prisma.newRelease.findUnique({
        where: { id: body.releaseId },
      });
      if (!release)
        return NextResponse.json(
          { error: "Release not found" },
          { status: 404 }
        );
      const fingerprint = shelfFingerprint(
        "release",
        release.artistName,
        release.title,
        release.title,
        release.mbid
      );
      const item = await prisma.listeningShelfItem.upsert({
        where: { fingerprint },
        update: { coverArtUrl: release.coverArtUrl },
        create: {
          fingerprint,
          kind: "release",
          artistName: release.artistName,
          title: release.title,
          albumName: release.title,
          releaseGroupMbid: release.mbid,
          coverArtUrl: release.coverArtUrl,
          source: "Discover",
        },
      });
      return NextResponse.json(item);
    }
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Could not save to Shelf" },
      { status: 503 }
    );
  }
}
