import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

export function playbackPosition(
  data: EnrichedNowPlaying | null,
  receivedAt: number,
  now: number
): number {
  if (!data) return 0;
  const position =
    data.positionMs +
    (data.playState === "playing" ? Math.max(0, now - receivedAt) : 0);
  return Math.max(
    0,
    data.durationMs > 0 ? Math.min(position, data.durationMs) : position
  );
}

export function trackIdentity(data: EnrichedNowPlaying | null): string {
  return data
    ? `${data.artistName}\u0000${data.trackName}\u0000${data.albumName ?? ""}`
    : "__idle__";
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
