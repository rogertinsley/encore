import { enrichNowPlaying } from "@/lib/enrichment/now-playing";
import type { LastFMClient } from "@/lib/lastfm/client";
import type { MusicBrainzClient } from "@/lib/musicbrainz/client";
import type { FanartTVClient } from "@/lib/fanart/client";
import type { CoverArtArchiveClient } from "@/lib/coverart/client";
import type { EversoloClient, EversoloTrack } from "@/lib/eversolo/client";

export const NOW_PLAYING_KEY = "now-playing";
const POLL_INTERVAL_MS = 3_000;
const CACHE_TTL_SECONDS = 30;
// The Eversolo briefly reports no track while switching songs. Keep the last
// track on screen through that gap, but still clear it after a genuine stop.
const IDLE_GRACE_MS = 5_000;

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

function trackKey(track: EversoloTrack): string {
  return JSON.stringify([track.artist, track.title, track.album, track.source]);
}

export function createNowPlayingPipeline(
  clients: PipelineClients,
  redis: PipelineRedis
): NowPlayingPipeline {
  const { eversolo, lastfm, musicBrainz, fanartTV, coverArt } = clients;

  let cachedTrackKey: string | null = null;
  let cachedEnrichment: Awaited<ReturnType<typeof enrichNowPlaying>> | null =
    null;
  let idleSince: number | null = null;
  let generation = 0;
  let polling = false;
  let pollQueued = false;
  let started = false;

  const poll = async (): Promise<void> => {
    try {
      const { track, playState } = await eversolo.getState();

      if (!track || playState === "idle") {
        if (cachedTrackKey) {
          idleSince ??= Date.now();
          if (Date.now() - idleSince < IDLE_GRACE_MS) return;
        }
        idleSince = null;
        cachedTrackKey = null;
        cachedEnrichment = null;
        generation++;
        await redis.del(NOW_PLAYING_KEY);
        return;
      }

      idleSince = null;
      const key = trackKey(track);

      if (key !== cachedTrackKey) {
        cachedTrackKey = key;
        cachedEnrichment = null;
        const thisGeneration = ++generation;
        const nowPlayingTrack = {
          trackName: track.title,
          artistName: track.artist,
          albumName: track.album || null,
          albumMbid: null,
        };
        void enrichNowPlaying(
          nowPlayingTrack,
          lastfm,
          musicBrainz,
          fanartTV,
          coverArt
        )
          .then((result) => {
            if (cachedTrackKey === key && generation === thisGeneration) {
              cachedEnrichment = result;
            }
          })
          .catch((err) => {
            console.error("[NowPlayingPoller] enrichment failed:", err);
          });
      }

      // Publish device metadata immediately. External enrichment is included
      // on later polls only if it still belongs to this exact track.
      const metadata = cachedEnrichment ?? {
        trackName: track.title,
        artistName: track.artist,
        albumName: track.album || null,
        albumMbid: null,
        artistImages: null,
        albumArtUrl: null,
        bio: null,
      };
      const data = {
        ...metadata,
        albumArtUrl: track.albumArtUrl ?? metadata.albumArtUrl,
        positionMs: track.positionMs,
        durationMs: track.durationMs,
        playState,
        audioFormat: track.audioFormat,
        source: track.source,
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
        idleSince = null;
        cachedTrackKey = null;
        cachedEnrichment = null;
        generation++;
        await redis.del(NOW_PLAYING_KEY).catch(() => null);
      } else {
        console.error("[NowPlayingPoller] poll failed:", err);
      }
    }
  };

  const requestPoll = (): void => {
    if (polling) {
      pollQueued = true;
      return;
    }
    polling = true;
    void poll().finally(() => {
      polling = false;
      if (pollQueued) {
        pollQueued = false;
        requestPoll();
      }
    });
  };

  return {
    start() {
      if (started) return;
      started = true;
      requestPoll();
      setInterval(requestPoll, POLL_INTERVAL_MS);
    },
    triggerPoll() {
      setTimeout(requestPoll, 300);
    },
  };
}
