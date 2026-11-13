import { NextResponse } from "next/server";
import { trackIdentity } from "@/lib/display/playback";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import { addArtistAndSearch } from "@/lib/lidarr/artists";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import { redis } from "@/lib/redis";
import { isSameOrigin } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!request.headers.has("origin") || !isSameOrigin(request)) {
    return NextResponse.json(
      { message: "Cross-origin request" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.expectedTrackIdentity !== "string") {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  try {
    const raw = await redis.get(NOW_PLAYING_KEY);
    const track = raw ? (JSON.parse(raw) as EnrichedNowPlaying) : null;
    if (
      !track?.artistName ||
      body.expectedTrackIdentity !== trackIdentity(track)
    ) {
      return NextResponse.json(
        { message: "Track changed. Please try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({
      message: await addArtistAndSearch(track.artistName),
    });
  } catch {
    return NextResponse.json(
      { message: "Lidarr request failed. Please try again." },
      { status: 502 }
    );
  }
}
