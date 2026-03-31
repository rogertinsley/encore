import { enrichNowPlaying } from "@/lib/enrichment/now-playing";
import type { LastFMClient } from "@/lib/lastfm/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";
import type { FanartTVClient } from "@/lib/fanart/client";
import type { CoverArtArchiveClient } from "@/lib/coverart/client";
import type { EversoloClient } from "@/lib/eversolo/client";

export const NOW_PLAYING_KEY = "now-playing";
const POLL_INTERVAL_MS = 3_000;
const CACHE_TTL_SECONDS = 30;

type PipelineClients = {
  eversolo: Pick<EversoloClient, "getState">;
  lastfm: Pick<LastFMClient, "getArtistInfo">;
  musicBrainz: Pick<MusicBrainzClient, "searchArtist" | "searchRelease">;
  fanartTV: Pick<FanartTVClient, "getArtistImages">;
  coverArt: Pick<
    CoverArtArchiveClient,
    "getAlbumArt" | "getAlbumArtByReleaseGroup"
  >;
};

type PipelineRedis = {
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

export interface NowPlayingPipeline {
  start(): void;
  triggerPoll(): void;
}

function trackKey(artist: string, title: string): string {
  return `${artist}:::${title}`;
}

export function createNowPlayingPipeline(
  clients: PipelineClients,
  redis: PipelineRedis
): NowPlayingPipeline {
  const { eversolo, lastfm, musicBrainz, fanartTV, coverArt } = clients;

  let cachedTrackKey: string | null = null;
  let cachedEnrichment: Awaited<ReturnType<typeof enrichNowPlaying>> | null =
    null;

  const poll = async (): Promise<void> => {
    try {
      const { track, playState } = await eversolo.getState();

      if (!track || playState === "idle") {
        cachedTrackKey = null;
        cachedEnrichment = null;
        await redis.del(NOW_PLAYING_KEY);
        return;
      }

      const key = trackKey(track.artist, track.title);

      if (key !== cachedTrackKey || !cachedEnrichment) {
        const nowPlayingTrack = {
          trackName: track.title,
          artistName: track.artist,
          albumName: track.album || null,
          albumMbid: null,
        };
        cachedEnrichment = await enrichNowPlaying(
          nowPlayingTrack,
          lastfm,
          musicBrainz,
          fanartTV,
          coverArt
        );
        cachedTrackKey = key;
      }

      const data = {
        ...cachedEnrichment,
        albumArtUrl: track.albumArtUrl ?? cachedEnrichment.albumArtUrl,
        positionMs: track.positionMs,
        durationMs: track.durationMs,
        playState,
        audioFormat: track.audioFormat,
      };

      await redis.setex(
        NOW_PLAYING_KEY,
        CACHE_TTL_SECONDS,
        JSON.stringify(data)
      );
    } catch (err) {
      // Network errors mean the device is off — treat as idle and stay quiet.
      const cause =
        err instanceof Error
          ? (err.cause as NodeJS.ErrnoException | undefined)
          : undefined;
      const code =
        cause?.code ??
        (err instanceof Error
          ? (err as NodeJS.ErrnoException).code
          : undefined);
      const deviceUnreachable = [
        "EHOSTDOWN",
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
      ].includes(code ?? "");
      if (deviceUnreachable) {
        cachedTrackKey = null;
        cachedEnrichment = null;
        await redis.del(NOW_PLAYING_KEY).catch(() => null);
      } else {
        console.error("[NowPlayingPoller] poll failed:", err);
      }
    }
  };

  return {
    start() {
      void poll();
      setInterval(poll, POLL_INTERVAL_MS);
    },
    triggerPoll() {
      setTimeout(() => void poll(), 300);
    },
  };
}
