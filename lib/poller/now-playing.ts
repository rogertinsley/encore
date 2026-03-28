import { clients } from "@/lib/clients";
import { enrichNowPlaying } from "@/lib/enrichment/now-playing";
import { redis } from "@/lib/redis";

export const NOW_PLAYING_KEY = "now-playing";
const POLL_INTERVAL_MS = 3_000;
const CACHE_TTL_SECONDS = 30;

function trackKey(artist: string, title: string): string {
  return `${artist}:::${title}`;
}

// Exposed so the control API can trigger an immediate poll after a command
let scheduledPoll: (() => Promise<void>) | null = null;

export function triggerImmediatePoll(): void {
  setTimeout(() => scheduledPoll?.(), 300);
}

export function startNowPlayingPoller(): void {
  const {
    lastfm,
    musicBrainzEnrichment: musicBrainz,
    fanartTV,
    coverArt,
    eversolo,
  } = clients;

  let cachedKey: string | null = null;
  let cachedEnrichment: Awaited<ReturnType<typeof enrichNowPlaying>> | null =
    null;

  const poll = async () => {
    try {
      const { track, playState } = await eversolo.getState();

      if (!track || playState === "idle") {
        cachedKey = null;
        cachedEnrichment = null;
        await redis.del(NOW_PLAYING_KEY);
        return;
      }

      const key = trackKey(track.artist, track.title);

      if (key !== cachedKey || !cachedEnrichment) {
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
        cachedKey = key;
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
      console.error("[NowPlayingPoller] poll failed:", err);
    }
  };

  scheduledPoll = poll;
  void poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
