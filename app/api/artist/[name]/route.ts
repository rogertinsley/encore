import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clients } from "@/lib/clients";
import type { ArtistImages } from "@/lib/fanart/client";
import type { TopTrack, TopAlbum, SimilarArtist } from "@/lib/lastfm/types";

const CACHE_TTL = 6 * 60 * 60;

export interface ArtistPageData {
  name: string;
  mbid: string | null;
  bio: string | null;
  tags: string[];
  listeners: number;
  userPlayCount: number | null;
  artistImages: ArtistImages | null;
  topTracks: TopTrack[];
  topAlbums: Array<TopAlbum & { coverArtUrl: string | null }>;
  similarArtists: SimilarArtist[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const artistName = decodeURIComponent(name);

  const cacheKey = `artist-page:${artistName.toLowerCase()}`;
  const cached = await redis.get(cacheKey);
  if (cached) return NextResponse.json(JSON.parse(cached) as ArtistPageData);

  const { lastfm, musicBrainz, fanartTV, coverArt } = clients;
  const username = process.env.LASTFM_USERNAME ?? "";

  const [artistInfo, topTracks, topAlbums, similarArtists, mbid] =
    await Promise.all([
      lastfm.getArtistInfo(artistName, username).catch(() => null),
      lastfm.getTopTracks(artistName, 10).catch(() => []),
      lastfm.getTopAlbums(artistName, 12).catch(() => []),
      lastfm.getSimilarArtists(artistName).catch(() => []),
      musicBrainz.searchArtist(artistName).catch(() => null),
    ]);

  const artistImages = mbid
    ? await fanartTV.getArtistImages(mbid).catch(() => null)
    : null;

  const topAlbumsWithArt = await Promise.all(
    topAlbums.map(async (album) => {
      const coverArtUrl = album.mbid
        ? await coverArt.getAlbumArtByReleaseGroup(album.mbid).catch(() => null)
        : null;
      return {
        ...album,
        coverArtUrl: coverArtUrl ?? album.imageUrl,
      };
    })
  );

  const data: ArtistPageData = {
    name: artistInfo?.name ?? artistName,
    mbid: artistInfo?.mbid ?? mbid,
    bio: artistInfo?.bio ?? null,
    tags: artistInfo?.tags ?? [],
    listeners: artistInfo?.listeners ?? 0,
    userPlayCount: artistInfo?.userPlayCount ?? null,
    artistImages,
    topTracks,
    topAlbums: topAlbumsWithArt,
    similarArtists: similarArtists.slice(0, 8),
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  return NextResponse.json(data);
}
