import { LastFMClient } from "@/lib/lastfm/client";
import { MusicBrainzClient } from "@/lib/musicbrainz/client";
import { FanartTVClient } from "@/lib/fanart/client";
import { CoverArtArchiveClient } from "@/lib/coverart/client";
import { EversoloClient } from "@/lib/eversolo/client";

export interface ApiClients {
  lastfm: LastFMClient;
  musicBrainz: MusicBrainzClient;
  fanartTV: FanartTVClient;
  coverArt: CoverArtArchiveClient;
  eversolo: EversoloClient;
}

export const clients: ApiClients = {
  lastfm: new LastFMClient(process.env.LASTFM_API_KEY ?? ""),
  musicBrainz: new MusicBrainzClient(1000), // MusicBrainz ToS: 1 req/s
  fanartTV: new FanartTVClient(process.env.FANART_TV_API_KEY ?? ""),
  coverArt: new CoverArtArchiveClient(),
  eversolo: new EversoloClient(process.env.EVERSOLO_HOST ?? "192.168.1.138"),
};
