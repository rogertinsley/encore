import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { getArtistImages } from "@/lib/artist-image/service";
import { readRedisSnapshot } from "@/lib/utils/redis-snapshot";

const IMAGE_CACHE = { freshFor: 86400, retainFor: 14 * 86400 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json(null);

  const cacheKey = `artist-image:v2:${name.toLowerCase()}`;

  let images: Awaited<ReturnType<typeof getArtistImages>>;
  try {
    images = await readRedisSnapshot(cacheKey, IMAGE_CACHE, () =>
      getArtistImages(name, clients)
    );
  } catch {
    // MusicBrainz error — don't cache, retry next request
    return NextResponse.json(null);
  }

  return NextResponse.json(images);
}
