import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { withCache } from "@/lib/utils/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist")?.trim();
  const album = searchParams.get("album")?.trim();
  if (!artist || !album || artist.length > 120 || album.length > 160) {
    return NextResponse.json(
      { error: "artist and album required" },
      { status: 400 }
    );
  }

  try {
    const key = `display-album-year:${JSON.stringify([artist.toLowerCase(), album.toLowerCase()])}`;
    const year = await withCache(key, 24 * 60 * 60, async () => {
      const mbid = await clients.musicBrainz.searchRelease(artist, album);
      return mbid ? clients.musicBrainz.getReleaseGroupYear(mbid) : null;
    });
    return NextResponse.json({ year });
  } catch {
    return NextResponse.json({ year: null });
  }
}
