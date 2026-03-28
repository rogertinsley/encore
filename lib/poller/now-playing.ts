import { LastFMClient } from "@/lib/lastfm/client";
import { MusicBrainzClient } from "@/lib/musicbrainz/client";
import { FanartTVClient } from "@/lib/fanart/client";
import { CoverArtArchiveClient } from "@/lib/coverart/client";
import { enrichNowPlaying } from "@/lib/enrichment/now-playing";
import { redis } from "@/lib/redis";

export const NOW_PLAYING_KEY = "now-playing";
const POLL_INTERVAL_MS = 30_000;
const CACHE_TTL_SECONDS = 60;

export function startNowPlayingPoller(): void {
  const lastfm = new LastFMClient(process.env.LASTFM_API_KEY ?? "");
  const musicBrainz = new MusicBrainzClient();
  const fanartTV = new FanartTVClient(process.env.FANART_TV_API_KEY ?? "");
  const coverArt = new CoverArtArchiveClient();
  const username = process.env.LASTFM_USERNAME ?? "";

  const poll = async () => {
    try {
      const track = await lastfm.getNowPlaying(username);
      if (track) {
        const enriched = await enrichNowPlaying(
          track,
          lastfm,
          musicBrainz,
          fanartTV,
          coverArt
        );
        await redis.setex(
          NOW_PLAYING_KEY,
          CACHE_TTL_SECONDS,
          JSON.stringify(enriched)
        );
      } else {
        await redis.del(NOW_PLAYING_KEY);
      }
    } catch (err) {
      console.error("[NowPlayingPoller] poll failed:", err);
    }
  };

  void poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
