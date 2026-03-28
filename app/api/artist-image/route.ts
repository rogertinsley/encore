import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clients } from "@/lib/clients";

const CACHE_TTL = 14 * 24 * 60 * 60; // 2 weeks

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json(null);

  const cacheKey = `artist-image:${name.toLowerCase()}`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(JSON.parse(cached));

  const { musicBrainz, fanartTV } = clients;

  let mbid: string | null;
  try {
    mbid = await musicBrainz.searchArtist(name);
  } catch {
    // MusicBrainz error — don't cache, retry next request
    return NextResponse.json(null);
  }
  if (!mbid) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(null));
    return NextResponse.json(null);
  }

  const images = await fanartTV.getArtistImages(mbid).catch(() => null);
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(images));
  return NextResponse.json(images);
}
