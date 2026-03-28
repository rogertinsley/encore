import type { NowPlayingTrack } from "@/lib/lastfm/types";
import type { LastFMClient } from "@/lib/lastfm/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";
import type { FanartTVClient, ArtistImages } from "@/lib/fanart/client";
import type { CoverArtArchiveClient } from "@/lib/coverart/client";

export interface EnrichedNowPlaying extends NowPlayingTrack {
  artistImages: ArtistImages | null;
  albumArtUrl: string | null;
  bio: string | null;
}

function stripBio(raw: string): string {
  const stripped = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/Read more on Last\.fm\.?\s*$/i, "")
    .trim();
  return stripped.length > 400
    ? stripped.slice(0, 400).trimEnd() + "…"
    : stripped;
}

export async function enrichNowPlaying(
  track: NowPlayingTrack,
  lastfm: Pick<LastFMClient, "getArtistInfo">,
  musicBrainz: Pick<MusicBrainzClient, "searchArtist">,
  fanartTV: Pick<FanartTVClient, "getArtistImages">,
  coverArt: Pick<CoverArtArchiveClient, "getAlbumArt">
): Promise<EnrichedNowPlaying> {
  const [artistInfo, mbid, albumArtUrl] = await Promise.all([
    lastfm.getArtistInfo(track.artistName).catch(() => null),
    musicBrainz.searchArtist(track.artistName).catch(() => null),
    track.albumMbid
      ? coverArt.getAlbumArt(track.albumMbid).catch(() => null)
      : Promise.resolve(null),
  ]);

  const artistImages = mbid
    ? await fanartTV.getArtistImages(mbid).catch(() => null)
    : null;

  return {
    ...track,
    artistImages,
    albumArtUrl,
    bio: artistInfo?.bio ? stripBio(artistInfo.bio) : null,
  };
}
