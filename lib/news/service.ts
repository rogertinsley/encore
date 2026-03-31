import Parser from "rss-parser";
import { FEEDS } from "./feeds";

const NEWS_CACHE_KEY = "news:raw";
const NEWS_CACHE_TTL = 60 * 60; // 1 hour

type NewsRedis = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
};

const parser = new Parser();

export interface RawNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
}

export interface NewsItem extends RawNewsItem {
  matchedArtist: string;
}

export async function fetchAllFeeds(): Promise<RawNewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.map(
        (item): RawNewsItem => ({
          title: item.title ?? "",
          url: item.link ?? "",
          source: feed.name,
          publishedAt: item.isoDate ?? null,
          summary: item.contentSnippet?.slice(0, 200) ?? null,
        })
      );
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RawNewsItem[]> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}

export function filterNewsByArtists(
  items: RawNewsItem[],
  artistNames: string[]
): NewsItem[] {
  const matched: NewsItem[] = [];

  for (const item of items) {
    const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
    for (const artist of artistNames) {
      if (artist.length > 2 && text.includes(artist.toLowerCase())) {
        matched.push({ ...item, matchedArtist: artist });
        break;
      }
    }
  }

  return matched
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, 10);
}

/**
 * Fetch and cache raw feeds in Redis, then filter by artist names.
 * Hides the two-step fetch-then-filter pipeline and the Redis cache key.
 */
export async function getPersonalisedNews(
  artistNames: string[],
  redis: NewsRedis
): Promise<NewsItem[]> {
  let rawItems: RawNewsItem[] | null = await redis
    .get(NEWS_CACHE_KEY)
    .then((r) => (r ? (JSON.parse(r) as RawNewsItem[]) : null));

  if (!rawItems) {
    rawItems = await fetchAllFeeds().catch(() => []);
    if (rawItems.length > 0) {
      await redis.setex(
        NEWS_CACHE_KEY,
        NEWS_CACHE_TTL,
        JSON.stringify(rawItems)
      );
    }
  }

  return filterNewsByArtists(rawItems, artistNames);
}
