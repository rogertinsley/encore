import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { normalizeTrack } from "@/lib/lastfm/transforms";

export async function GET() {
  try {
    const tracks = await clients.lastfm.getRecentTracks(
      process.env.LASTFM_USERNAME ?? "",
      50
    );
    return NextResponse.json(tracks.map(normalizeTrack));
  } catch {
    return NextResponse.json([]);
  }
}
