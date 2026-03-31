import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clients } from "@/lib/clients";
import {
  generateLeadReview,
  generateWeeklyDigest,
  generateAlbumReview,
  generateArtistSpotlight,
} from "@/lib/ai/editorial";
import { getPersonalisedNews } from "@/lib/news/service";
import type { NewsItem } from "@/lib/news/service";
import { filterPlaceholder } from "@/lib/lastfm/utils";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

const CACHE_TTL = 60 * 60; // 1 hour

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface EditorialData {
  lead: {
    artistName: string;
    albumName: string | null;
    backgroundUrl: string | null;
    albumArtUrl: string | null;
    review: string;
    pullQuote: string;
  } | null;
  weeklyDigest: string | null;
  albumReviews: Array<{
    artistName: string;
    albumName: string;
    imageUrl: string | null;
    review: string;
    pullQuote: string;
  }>;
  artistSpotlight: {
    artistName: string;
    content: string;
    imageUrl: string | null;
  } | null;
  news: NewsItem[];
}

export async function GET() {
  const username = process.env.LASTFM_USERNAME ?? "";
  const { lastfm } = clients;

  // Lead: currently playing
  const nowRaw = await redis.get(NOW_PLAYING_KEY);
  const nowPlaying: EnrichedNowPlaying | null = nowRaw
    ? JSON.parse(nowRaw)
    : null;

  const leadArtist = nowPlaying?.artistName ?? null;
  const leadAlbum = nowPlaying?.albumName ?? null;

  // Cache key includes today + current artist+album so it refreshes on track change
  const cacheKey = `editorial:${todayKey()}:${leadArtist ?? "none"}:${leadAlbum ?? "none"}`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(JSON.parse(cached) as EditorialData);

  // Fetch recent tracks for weekly digest + album reviews
  const [recentTracks, topArtists] = await Promise.all([
    lastfm.getRecentTracks(username, 50).catch(() => []),
    lastfm.getTopArtists(username, "7day").catch(() => []),
  ]);

  // Dedupe recent artists for the digest
  const recentArtistNames = [
    ...new Set(recentTracks.map((t) => t.artistName)),
  ].slice(0, 12);
  const topArtist = topArtists[0]?.name ?? recentArtistNames[0] ?? null;

  // Artist names for news matching — top artists + recent
  const allArtistNames = [
    ...new Set([...topArtists.map((a) => a.name), ...recentArtistNames]),
  ].slice(0, 30);

  // Top 3 most-scrobbled albums this week (best effort from recent tracks)
  const albumCounts = new Map<
    string,
    { artist: string; album: string; count: number; imageUrl: string | null }
  >();
  for (const t of recentTracks) {
    if (!t.albumName) continue;
    const key = `${t.artistName}:::${t.albumName}`;
    const existing = albumCounts.get(key);
    const imageUrl = filterPlaceholder(t.albumArtUrl);
    if (existing) {
      existing.count++;
    } else {
      albumCounts.set(key, {
        artist: t.artistName,
        album: t.albumName,
        count: 1,
        imageUrl,
      });
    }
  }
  const topAlbums = [...albumCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Spotlight artist — pick one from recent that isn't the lead
  const spotlightArtist =
    recentArtistNames.find((a) => a !== leadArtist) ?? null;

  // News — cached separately so items survive editorial cache busts
  const news = await getPersonalisedNews(allArtistNames, redis).catch(() => []);

  // Generate all AI content in parallel
  const [leadReview, weeklyDigest, albumReviewResults, spotlightContent] =
    await Promise.all([
      leadArtist
        ? generateLeadReview(
            leadArtist,
            leadAlbum ?? "their album",
            [],
            nowPlaying?.bio ?? null
          ).catch(() => null)
        : null,
      topArtist && recentArtistNames.length > 0
        ? generateWeeklyDigest(recentArtistNames, topArtist).catch(() => null)
        : null,
      Promise.all(
        topAlbums.map((a) =>
          generateAlbumReview(a.artist, a.album)
            .then((r) => ({ ...a, ...r }))
            .catch(() => null)
        )
      ),
      spotlightArtist
        ? generateArtistSpotlight(spotlightArtist).catch(() => null)
        : null,
    ]);

  // Spotlight image
  let spotlightImageUrl: string | null = null;
  if (spotlightArtist) {
    const spotlightImages = await clients.fanartTV
      .getArtistImages(
        (await clients.musicBrainz
          .searchArtist(spotlightArtist)
          .catch(() => null)) ?? ""
      )
      .catch(() => null);
    spotlightImageUrl = spotlightImages?.thumbnail ?? null;
  }

  const data: EditorialData = {
    lead:
      leadArtist && leadReview
        ? {
            artistName: leadArtist,
            albumName: leadAlbum,
            backgroundUrl: nowPlaying?.artistImages?.background ?? null,
            albumArtUrl: nowPlaying?.albumArtUrl ?? null,
            review: leadReview.review,
            pullQuote: leadReview.pullQuote,
          }
        : null,
    weeklyDigest: weeklyDigest ?? null,
    albumReviews: albumReviewResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        artistName: r.artist,
        albumName: r.album,
        imageUrl: r.imageUrl,
        review: r.review,
        pullQuote: r.pullQuote,
      })),
    artistSpotlight:
      spotlightArtist && spotlightContent
        ? {
            artistName: spotlightArtist,
            content: spotlightContent,
            imageUrl: spotlightImageUrl,
          }
        : null,
    news,
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  return NextResponse.json(data);
}
