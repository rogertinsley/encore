import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clients } from "@/lib/clients";
import type {
  Period,
  UserTopTrack,
  UserTopAlbum,
  TopArtist,
  TopTag,
} from "@/lib/lastfm/client";

const CACHE_TTL = 60 * 60; // 1 hour
const VALID_PERIODS: Period[] = [
  "7day",
  "1month",
  "3month",
  "6month",
  "12month",
  "overall",
];

export interface AnalyticsData {
  period: Period;
  userInfo: { totalScrobbles: number; registeredAt: string };
  topArtists: TopArtist[];
  topTracks: UserTopTrack[];
  topAlbums: UserTopAlbum[];
  topTags: TopTag[];
  newArtists: Array<{ name: string; playCount: number }>;
  heatmap: number[][]; // [7 days][24 hours]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "1month";
  if (!VALID_PERIODS.includes(periodParam as Period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const period = periodParam as Period;

  const username = process.env.LASTFM_USERNAME ?? "";
  const cacheKey = `analytics:${username}:${period}`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(JSON.parse(cached) as AnalyticsData);

  const { lastfm } = clients;

  const [
    userInfo,
    topArtists,
    topTracks,
    topAlbums,
    topTags,
    overallArtists,
    recentTracks,
  ] = await Promise.all([
    lastfm.getUserInfo(username).catch(() => null),
    lastfm.getTopArtists(username, period).catch(() => []),
    lastfm.getUserTopTracks(username, period, 20).catch(() => []),
    lastfm.getUserTopAlbums(username, period, 12).catch(() => []),
    lastfm.getTopTags(username).catch(() => []),
    // Always fetch overall to compute new artists
    period !== "overall"
      ? lastfm.getTopArtists(username, "overall").catch(() => [])
      : Promise.resolve([] as TopArtist[]),
    lastfm.getRecentTracks(username, 200).catch(() => []),
  ]);

  // New artists: appear in period top but not in overall top 100
  const overallNames = new Set(overallArtists.map((a) => a.name.toLowerCase()));
  const newArtists =
    period !== "overall"
      ? topArtists
          .filter((a) => !overallNames.has(a.name.toLowerCase()))
          .map((a) => ({ name: a.name, playCount: a.playCount }))
          .slice(0, 10)
      : [];

  // Listening heatmap: [dayOfWeek 0=Mon][hour 0-23]
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0)
  );
  for (const track of recentTracks) {
    if (!track.scrobbledAt) continue;
    const d = new Date(track.scrobbledAt);
    const dow = (d.getDay() + 6) % 7; // convert Sun=0 to Mon=0
    const hour = d.getHours();
    heatmap[dow][hour]++;
  }

  const data: AnalyticsData = {
    period,
    userInfo: userInfo
      ? {
          totalScrobbles: userInfo.totalScrobbles,
          registeredAt: userInfo.registeredAt.toISOString(),
        }
      : { totalScrobbles: 0, registeredAt: new Date(0).toISOString() },
    topArtists,
    topTracks,
    topAlbums,
    topTags: topTags.slice(0, 15),
    newArtists,
    heatmap,
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  return NextResponse.json(data);
}
