import type { EversoloState } from "@/lib/eversolo/client";

interface PlexSession {
  type?: string;
  title?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  duration?: number;
  viewOffset?: number;
  User?: { title?: string };
  Player?: { product?: string; state?: string };
}

const idle: EversoloState = { track: null, playState: "idle" };

export class PlexClient {
  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
    private readonly username?: string
  ) {}

  async getState(): Promise<EversoloState> {
    const response = await fetch(new URL("/status/sessions", this.serverUrl), {
      headers: { Accept: "application/json", "X-Plex-Token": this.token },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok)
      throw new Error(`Plex sessions returned HTTP ${response.status}`);
    const data = (await response.json()) as {
      MediaContainer?: { Metadata?: PlexSession[] };
    };
    const sessions = (data.MediaContainer?.Metadata ?? []).filter(
      (session) =>
        session.type === "track" &&
        session.Player?.product?.toLowerCase() === "plexamp" &&
        session.title &&
        session.grandparentTitle &&
        (!this.username ||
          session.User?.title?.toLowerCase() === this.username.toLowerCase())
    );

    const session =
      sessions.find((item) => item.Player?.state === "playing") ??
      sessions.find((item) => item.Player?.state === "paused");
    if (!session) return idle;

    return {
      playState: session.Player?.state === "playing" ? "playing" : "paused",
      track: {
        title: session.title!,
        artist: session.grandparentTitle!,
        album: session.parentTitle ?? "",
        durationMs: Math.max(0, session.duration ?? 0),
        positionMs: Math.max(0, session.viewOffset ?? 0),
        source: "plexamp",
        albumArtUrl: null,
        audioFormat: null,
      },
    };
  }
}
