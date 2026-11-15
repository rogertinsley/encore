import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { getArtistPageData } from "@/lib/artist/service";
import { getLidarrArtistStatus } from "@/lib/lidarr/artists";
import { getReleaseProgress } from "@/lib/lidarr/progress";
import { withCache } from "@/lib/utils/cache";

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

const CACHE_TTL = 6 * 60 * 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const artistName = decodeURIComponent(name);
  const cacheKey = `artist-page:${artistName.toLowerCase()}`;

  const [data, progress] = await Promise.all([
    withCache(cacheKey, CACHE_TTL, () =>
      getArtistPageData(artistName, clients, process.env.LASTFM_USERNAME ?? "")
    ),
    getReleaseProgress(),
  ]);

  return NextResponse.json({
    ...data,
    lidarrConfigured: Boolean(process.env.LIDARR_API_KEY),
    lidarrTracked: await getLidarrArtistStatus(data.name, data.mbid),
    topAlbums: data.topAlbums.map((album) => ({
      ...album,
      lidarrStatus: progress(album.mbid || null),
    })),
  } satisfies ArtistResponse);
}
