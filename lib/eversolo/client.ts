export type PlayState = "playing" | "paused" | "idle";

export interface AudioFormat {
  extension: string;
  sampleRate: string;
  bits: string;
  channels: number;
}

export interface EversoloTrack {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  positionMs: number;
  albumArtUrl: string | null;
  audioFormat: AudioFormat | null;
}

export interface EversoloState {
  track: EversoloTrack | null;
  playState: PlayState;
}

type ControlAction = "playOrPause" | "playNext" | "playLast";

export interface QueueTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  active: boolean;
}

export interface PlayQueue {
  tracks: QueueTrack[];
  total: number;
}

// Typed shapes for the two firmware response paths

interface ZidooPlayingMusic {
  title?: string;
  artist?: string;
  album?: string;
  extension?: string;
  sampleRate?: string;
  bits?: string;
  channels?: number;
  albumArtBig?: string;
  albumArt?: string;
}

interface ZidooAudioInfo {
  songName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
}

interface ZidooStateResponse {
  state?: number;
  duration?: number;
  position?: number;
  playingMusic?: ZidooPlayingMusic;
  everSoloPlayInfo?: { everSoloPlayAudioInfo?: ZidooAudioInfo };
}

interface ZidooQueueItem {
  id: number;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  active?: boolean;
}

interface ZidooQueueResponse {
  array?: ZidooQueueItem[];
  total?: number;
}

export class EversoloClient {
  private baseUrl: string;

  constructor(host: string) {
    this.baseUrl = `http://${host}:9529`;
  }

  async getState(): Promise<EversoloState> {
    const res = await fetch(`${this.baseUrl}/ZidooMusicControl/v2/getState`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ZidooStateResponse;

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
        audioFormat:
          pm.extension || pm.sampleRate
            ? {
                extension: pm.extension ?? "",
                sampleRate: pm.sampleRate ?? "",
                bits: pm.bits ?? "",
                channels: pm.channels ?? 2,
              }
            : null,
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
          audioFormat: null,
        };
      }
    }

    return { track, playState };
  }

  async getPlayQueue(): Promise<PlayQueue> {
    try {
      const res = await fetch(
        `${this.baseUrl}/ZidooMusicControl/v2/getPlayQueue`
      );
      if (!res.ok) return { tracks: [], total: 0 };
      const data = (await res.json()) as ZidooQueueResponse;
      if (!Array.isArray(data.array)) return { tracks: [], total: 0 };
      return {
        total: data.total ?? data.array.length,
        tracks: data.array.map(
          (t): QueueTrack => ({
            id: t.id,
            title: t.title ?? "",
            artist: t.artist ?? "",
            album: t.album ?? "",
            durationMs: t.duration ?? 0,
            active: t.active === true,
          })
        ),
      };
    } catch {
      return { tracks: [], total: 0 };
    }
  }

  async isArtistInLibrary(name: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/ZidooMusicControl/v2/searchArtistV2?key=${encodeURIComponent(name)}&start=0&count=1`
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { total?: number };
      return (data.total ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async control(action: ControlAction): Promise<void> {
    const res = await fetch(`${this.baseUrl}/ZidooMusicControl/v2/${action}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
