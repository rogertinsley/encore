import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { getArtistPageData } from "@/lib/artist/service";
import { getLidarrArtistStatus } from "@/lib/lidarr/artists";
import { getLidarrAlbums, resolveArtistAlbumMbid } from "@/lib/lidarr/releases";
import { getReleaseProgress } from "@/lib/lidarr/progress";
import { readRedisSnapshot } from "@/lib/utils/redis-snapshot";

import type { ArtistPageData } from "@/lib/artist/service";
import type { ReleaseProgress } from "@/lib/lidarr/progress";

export type ArtistResponse = Omit<ArtistPageData, "topAlbums"> & {
  lidarrConfigured: boolean;
  lidarrTracked: boolean | null;
  topAlbums: Array<
    ArtistPageData["topAlbums"][number] & {
      lidarrMbid: string | null;
      lidarrStatus: ReleaseProgress | null;
    }
  >;
};

export interface ArtistLidarrStatus {
  lidarrTracked: boolean | null;
  topAlbums: Array<{
    name: string;
    mbid: string | null;
    lidarrMbid: string | null;
    lidarrStatus: ReleaseProgress | null;
    year: number | null;
    coverArtUrl: string | null;
  }>;
}

const ARTIST_CACHE = { freshFor: 6 * 3600, retainFor: 7 * 86400 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const cacheKey = `artist-page:v4:${name.toLowerCase()}`;
  const searchParams = new URL(request.url).searchParams;
  const detailsOnly = searchParams.get("details") === "1";
  const readArtist = () =>
    readRedisSnapshot(
      detailsOnly ? `${cacheKey}:basic` : cacheKey,
      ARTIST_CACHE,
      () =>
        getArtistPageData(
          name,
          clients,
          process.env.LASTFM_USERNAME ?? "",
          !detailsOnly
        ),
      (artist) =>
        artist.listeners > 0 ||
        artist.topTracks.length > 0 ||
        artist.topAlbums.length > 0
    );
  const artistPromise = readArtist();
  const albumsPromise = detailsOnly ? Promise.resolve(null) : getLidarrAlbums();
  const [data, progress, lidarrTracked, albums] = await Promise.all([
    artistPromise,
    detailsOnly ? () => null : getReleaseProgress(albumsPromise),
    detailsOnly
      ? null
      : artistPromise.then((artist) =>
          getLidarrArtistStatus(artist.name, artist.mbid)
        ),
    albumsPromise,
  ]);
  const topAlbums = data.topAlbums.map((album) => {
    const lidarrMbid =
      album.releaseGroupMbid ??
      resolveArtistAlbumMbid(albums, album, data.mbid);
    return { ...album, lidarrMbid, lidarrStatus: progress(lidarrMbid) };
  });

  if (searchParams.get("status") === "1") {
    return NextResponse.json({
      lidarrTracked,
      topAlbums: topAlbums.map(
        ({ name, mbid, lidarrMbid, lidarrStatus, year, coverArtUrl }) => ({
          name,
          mbid,
          lidarrMbid,
          lidarrStatus,
          year,
          coverArtUrl,
        })
      ),
    } satisfies ArtistLidarrStatus);
  }

  return NextResponse.json({
    ...data,
    lidarrConfigured: Boolean(process.env.LIDARR_API_KEY),
    lidarrTracked,
    topAlbums,
  } satisfies ArtistResponse);
}
