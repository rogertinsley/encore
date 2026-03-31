import type { LastFMClient } from "@/lib/lastfm/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";
import type { FanartTVClient, ArtistImages } from "@/lib/fanart/client";
import type { CoverArtArchiveClient } from "@/lib/coverart/client";
import type { TopTrack, TopAlbum, SimilarArtist } from "@/lib/lastfm/types";
import { LASTFM_PLACEHOLDER } from "@/lib/lastfm/constants";

export interface ArtistPageData {
  name: string;
  mbid: string | null;
  bio: string | null;
  tags: string[];
  listeners: number;
  userPlayCount: number | null;
  artistImages: ArtistImages | null;
  topTracks: TopTrack[];
  topAlbums: Array<
    TopAlbum & { coverArtUrl: string | null; year: number | null }
  >;
  similarArtists: SimilarArtist[];
}

type Clients = {
  lastfm: Pick<
    LastFMClient,
    "getArtistInfo" | "getTopTracks" | "getTopAlbums" | "getSimilarArtists"
  >;
  musicBrainz: Pick<MusicBrainzClient, "searchArtist" | "getReleaseGroupYear">;
  fanartTV: Pick<FanartTVClient, "getArtistImages">;
  coverArt: Pick<CoverArtArchiveClient, "getAlbumArtByReleaseGroup">;
};

export async function getArtistPageData(
  artistName: string,
  { lastfm, musicBrainz, fanartTV, coverArt }: Clients,
  username: string
): Promise<ArtistPageData> {
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
      const [coverArtUrl, year] = await Promise.all([
        album.mbid
          ? coverArt.getAlbumArtByReleaseGroup(album.mbid).catch(() => null)
          : null,
        album.mbid
          ? musicBrainz.getReleaseGroupYear(album.mbid).catch(() => null)
          : null,
      ]);
      return {
        ...album,
        coverArtUrl:
          coverArtUrl ??
          (album.imageUrl?.includes(LASTFM_PLACEHOLDER)
            ? null
            : album.imageUrl),
        year,
      };
    })
  );

  return {
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
}
