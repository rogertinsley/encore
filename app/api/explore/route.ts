import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { getReleaseProgress } from "@/lib/lidarr/progress";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const type = params.get("type");
  if (!query || query.length > 120 || (type !== "artist" && type !== "album")) {
    return NextResponse.json(
      { message: "Enter an artist or album title." },
      { status: 400 }
    );
  }

  try {
    const [results, progress] = await Promise.all([
      clients.musicBrainz.searchCatalog(query, type),
      type === "album" ? getReleaseProgress() : () => null,
    ]);
    return NextResponse.json({
      artists: results.artists,
      releases: results.releases.map((release) => ({
        ...release,
        lidarrStatus: progress(release.mbid),
      })),
      lidarrConfigured: Boolean(process.env.LIDARR_API_KEY),
    });
  } catch (error) {
    console.warn("[Explore] Catalog search failed", error);
    return NextResponse.json(
      { message: "Search is temporarily unavailable. Try again." },
      { status: 502 }
    );
  }
}
