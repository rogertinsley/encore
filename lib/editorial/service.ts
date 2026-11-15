import {
  generateLeadReview,
  generateWeeklyDigest,
  generateAlbumReview,
  generateArtistSpotlight,
} from "@/lib/ai/editorial";
import { getPersonalisedNews } from "@/lib/news/service";
import { filterPlaceholder } from "@/lib/lastfm/utils";
import type { LastFMClient } from "@/lib/lastfm/client";
import type { RecentTrack } from "@/lib/lastfm/types";
import type { TopArtist } from "@/lib/lastfm/types";
import type { NewsItem } from "@/lib/news/service";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import type { FanartTVClient } from "@/lib/fanart/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";

type EditorialClients = {
  lastfm: Pick<LastFMClient, "getSimilarArtists">;
  musicBrainz: Pick<MusicBrainzClient, "searchArtist">;
  fanartTV: Pick<FanartTVClient, "getArtistImages">;
};

type EditorialRedis = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
};

export interface EditorialData {
  featureContext?: {
    recentPlays: number;
    trackName: string | null;
    relatedArtist: string | null;
  };
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

async function fetchSpotlightImage(
  artistName: string,
  clients: EditorialClients
): Promise<string | null> {
  const mbid = await clients.musicBrainz
    .searchArtist(artistName)
    .catch(() => null);
  if (!mbid) return null;
  const images = await clients.fanartTV.getArtistImages(mbid).catch(() => null);
  return images?.thumbnail ?? null;
}

export async function buildEditorialData(
  nowPlaying: EnrichedNowPlaying | null,
  recentTracks: RecentTrack[],
  topArtists: TopArtist[],
  clients: EditorialClients,
  redis: EditorialRedis
): Promise<EditorialData> {
  const leadArtist = nowPlaying?.artistName ?? null;
  const leadAlbum = nowPlaying?.albumName ?? null;

  const recentArtistNames = [
    ...new Set(recentTracks.map((t) => t.artistName)),
  ].slice(0, 12);
  const topArtist = topArtists[0]?.name ?? recentArtistNames[0] ?? null;

  const allArtistNames = [
    ...new Set([...topArtists.map((a) => a.name), ...recentArtistNames]),
  ].slice(0, 30);

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

  const spotlightArtist =
    recentArtistNames.find((a) => a !== leadArtist) ?? null;

  const featureArtist = leadArtist ?? topAlbums[0]?.artist;
  const similarArtists = featureArtist
    ? clients.lastfm.getSimilarArtists(featureArtist).catch(() => [])
    : Promise.resolve([]);

  const [
    leadReview,
    weeklyDigest,
    albumReviewResults,
    spotlightContent,
    news,
    spotlightImageUrl,
    relatedArtists,
  ] = await Promise.all([
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
    getPersonalisedNews(allArtistNames, redis).catch(() => [] as NewsItem[]),
    spotlightArtist ? fetchSpotlightImage(spotlightArtist, clients) : null,
    similarArtists,
  ]);

  const featured =
    leadArtist && leadReview
      ? { artist: leadArtist, album: leadAlbum }
      : albumReviewResults.find((review) => review !== null);
  const matchingTracks = featured
    ? recentTracks.filter(
        (track) =>
          track.artistName === featured.artist &&
          (!featured.album || track.albumName === featured.album)
      )
    : [];
  const trackName =
    featured &&
    nowPlaying?.artistName === featured.artist &&
    (!featured.album || nowPlaying.albumName === featured.album)
      ? nowPlaying.trackName
      : matchingTracks[0]?.trackName;

  return {
    featureContext: featured
      ? {
          recentPlays: matchingTracks.filter((track) =>
            Boolean(track.scrobbledAt)
          ).length,
          trackName: trackName ?? null,
          relatedArtist:
            featured.artist === featureArtist
              ? (relatedArtists.find(
                  (artist) => artist.name !== featured.artist
                )?.name ?? null)
              : null,
        }
      : undefined,
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
            imageUrl: spotlightImageUrl ?? null,
          }
        : null,
    news: news ?? [],
  };
}
