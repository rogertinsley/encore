export type PlayState = "playing" | "paused" | "idle";

export interface EversoloTrack {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  positionMs: number;
  albumArtUrl: string | null;
}

export interface EversoloState {
  track: EversoloTrack | null;
  playState: PlayState;
}

export class EversoloClient {
  private baseUrl: string;

  constructor(host: string) {
    this.baseUrl = `http://${host}:9529`;
  }

  async getState(): Promise<EversoloState> {
    const res = await fetch(`${this.baseUrl}/ZidooMusicControl/v2/getState`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;

    const raw: number = data.state ?? 0;
    const playState: PlayState =
      raw === 3 ? "playing" : raw === 4 ? "paused" : "idle";

    let track: EversoloTrack | null = null;

    const pm = data.playingMusic;
    if (pm?.title) {
      track = {
        title: pm.title,
        artist: pm.artist ?? "",
        album: pm.album ?? "",
        durationMs: data.duration ?? 0,
        positionMs: data.position ?? 0,
        albumArtUrl: pm.albumArtBig ?? pm.albumArt ?? null,
      };
    }

    if (!track) {
      const ai = data.everSoloPlayInfo?.everSoloPlayAudioInfo;
      if (ai?.songName) {
        track = {
          title: ai.songName,
          artist: ai.artistName ?? "",
          album: ai.albumName ?? "",
          durationMs: data.duration ?? 0,
          positionMs: data.position ?? 0,
          albumArtUrl: ai.albumArt ?? null,
        };
      }
    }

    return { track, playState };
  }
}
