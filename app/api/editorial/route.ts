import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clients } from "@/lib/clients";
import { buildEditorialData } from "@/lib/editorial/service";
import type { EditorialData } from "@/lib/editorial/service";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

const CACHE_TTL = 60 * 60; // 1 hour

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type { EditorialData };

export async function GET() {
  const username = process.env.LASTFM_USERNAME ?? "";

  const nowRaw = await redis.get(NOW_PLAYING_KEY);
  const nowPlaying: EnrichedNowPlaying | null = nowRaw
    ? JSON.parse(nowRaw)
    : null;

  const leadArtist = nowPlaying?.artistName ?? null;
  const leadAlbum = nowPlaying?.albumName ?? null;

  const cacheKey = `editorial:${todayKey()}:${leadArtist ?? "none"}:${leadAlbum ?? "none"}`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(JSON.parse(cached) as EditorialData);

  const [recentTracks, topArtists] = await Promise.all([
    clients.lastfm.getRecentTracks(username, 50).catch(() => []),
    clients.lastfm.getTopArtists(username, "7day").catch(() => []),
  ]);

  const data = await buildEditorialData(
    nowPlaying,
    recentTracks,
    topArtists,
    { musicBrainz: clients.musicBrainz, fanartTV: clients.fanartTV },
    redis
  );

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  return NextResponse.json(data);
}
