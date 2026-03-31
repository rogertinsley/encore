import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { filterPlaceholder } from "@/lib/lastfm/utils";

export async function GET() {
  try {
    const tracks = await clients.lastfm.getRecentTracks(
      process.env.LASTFM_USERNAME ?? "",
      50
    );
    return NextResponse.json(
      tracks.map((t) => ({
        ...t,
        albumArtUrl: filterPlaceholder(t.albumArtUrl),
        scrobbledAt: t.scrobbledAt?.toISOString() ?? null,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
