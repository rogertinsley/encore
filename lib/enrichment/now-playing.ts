import type { NowPlayingTrack } from "@/lib/lastfm/types";
import type { LastFMClient } from "@/lib/lastfm/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";
import type { FanartTVClient, ArtistImages } from "@/lib/fanart/client";
import type { CoverArtArchiveClient } from "@/lib/coverart/client";
import type { PlayState, AudioFormat } from "@/lib/eversolo/client";
import { stripBio as stripBioText } from "@/lib/utils/bio";

export interface EnrichedNowPlaying extends NowPlayingTrack {
  artistImages: ArtistImages | null;
  albumArtUrl: string | null;
  bio: string | null;
  positionMs: number;
  durationMs: number;
  playState: PlayState;
  audioFormat: AudioFormat | null;
}

function stripBio(raw: string): string {
  const stripped = stripBioText(raw);
  return stripped.length > 400
    ? stripped.slice(0, 400).trimEnd() + "…"
    : stripped;
}

async function resolveAlbumArt(
  track: NowPlayingTrack,
  musicBrainz: Pick<MusicBrainzClient, "searchRelease">,
  coverArt: Pick<
    CoverArtArchiveClient,
    "getAlbumArt" | "getAlbumArtByReleaseGroup"
  >
): Promise<string | null> {
  // Try Last.FM album MBID first (direct release lookup)
  if (track.albumMbid) {
    const art = await coverArt.getAlbumArt(track.albumMbid).catch(() => null);
    if (art) return art;
  }

  // Fallback: search MusicBrainz by artist + album name → release-group MBID
  if (track.albumName) {
    const rgMbid = await musicBrainz
      .searchRelease(track.artistName, track.albumName)
      .catch(() => null);
    if (rgMbid) {
      return coverArt.getAlbumArtByReleaseGroup(rgMbid).catch(() => null);
    }
  }

  return null;
}

export async function enrichNowPlaying(
  track: NowPlayingTrack,
  lastfm: Pick<LastFMClient, "getArtistInfo">,
  musicBrainz: Pick<MusicBrainzClient, "searchArtist" | "searchRelease">,
  fanartTV: Pick<FanartTVClient, "getArtistImages">,
  coverArt: Pick<
    CoverArtArchiveClient,
    "getAlbumArt" | "getAlbumArtByReleaseGroup"
  >
): Promise<
  Omit<
    EnrichedNowPlaying,
    "positionMs" | "durationMs" | "playState" | "audioFormat"
  >
> {
  const [artistInfo, mbid, albumArtUrl] = await Promise.all([
    lastfm.getArtistInfo(track.artistName).catch(() => null),
    musicBrainz.searchArtist(track.artistName).catch(() => null),
    resolveAlbumArt(track, musicBrainz, coverArt),
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
