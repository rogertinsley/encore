import { PlexClient } from "@/lib/plex/client";
import { clients } from "@/lib/clients";
import { redis } from "@/lib/redis";
import { createNowPlayingPipeline } from "./now-playing";

const plexUrl = process.env.PLEX_URL?.trim();
const plexToken = process.env.PLEX_TOKEN?.trim();

export const nowPlayingPipeline = createNowPlayingPipeline(
  {
    eversolo: clients.eversolo,
    plex:
      plexUrl && plexToken
        ? new PlexClient(plexUrl, plexToken, process.env.PLEX_USERNAME?.trim())
        : undefined,
    lastfm: clients.lastfm,
    musicBrainz: clients.musicBrainzEnrichment,
    fanartTV: clients.fanartTV,
    coverArt: clients.coverArt,
  },
  redis
);
