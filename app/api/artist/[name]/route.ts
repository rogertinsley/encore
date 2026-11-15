import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { getArtistPageData } from "@/lib/artist/service";
import { getLidarrArtistStatus } from "@/lib/lidarr/artists";
import { getReleaseProgress } from "@/lib/lidarr/progress";
import { readRedisSnapshot } from "@/lib/utils/redis-snapshot";

import type { ArtistPageData } from "@/lib/artist/service";
import type { ReleaseProgress } from "@/lib/lidarr/progress";

export type ArtistResponse = Omit<ArtistPageData, "topAlbums"> & {
  lidarrConfigured: boolean;
  lidarrTracked: boolean | null;
  topAlbums: Array<
    ArtistPageData["topAlbums"][number] & {
      lidarrStatus: ReleaseProgress | null;
    }
  >;
};

export interface ArtistLidarrStatus {
  lidarrTracked: boolean | null;
  topAlbums: Array<{
    mbid: string | null;
    lidarrStatus: ReleaseProgress | null;
  }>;
}

const ARTIST_CACHE = { freshFor: 6 * 3600, retainFor: 7 * 86400 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const cacheKey = `artist-page:v2:${name.toLowerCase()}`;
  const searchParams = new URL(request.url).searchParams;
  const detailsOnly = searchParams.get("details") === "1";
  const readArtist = () =>
    readRedisSnapshot(
      cacheKey,
      ARTIST_CACHE,
      () => getArtistPageData(name, clients, process.env.LASTFM_USERNAME ?? ""),
      (artist) =>
        artist.listeners > 0 ||
        artist.topTracks.length > 0 ||
        artist.topAlbums.length > 0
    );
  const artistPromise = readArtist();
  const [data, progress, lidarrTracked] = await Promise.all([
    artistPromise,
    detailsOnly ? () => null : getReleaseProgress(),
    detailsOnly
      ? null
      : artistPromise.then((artist) =>
          getLidarrArtistStatus(artist.name, artist.mbid)
        ),
  ]);

  if (searchParams.get("status") === "1") {
    return NextResponse.json({
      lidarrTracked,
      topAlbums: data.topAlbums.map(({ mbid }) => ({
        mbid,
        lidarrStatus: progress(mbid || null),
      })),
    } satisfies ArtistLidarrStatus);
  }

  return NextResponse.json({
    ...data,
    lidarrConfigured: Boolean(process.env.LIDARR_API_KEY),
    lidarrTracked,
    topAlbums: data.topAlbums.map((album) => ({
      ...album,
      lidarrStatus: progress(album.mbid || null),
    })),
  } satisfies ArtistResponse);
}
