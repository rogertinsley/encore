import { describe, expect, it } from "vitest";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import { formatTime, playbackPosition, trackIdentity } from "./playback";

const track = (
  overrides: Partial<EnrichedNowPlaying> = {}
): EnrichedNowPlaying => ({
  trackName: "Track",
  artistName: "Artist",
  albumName: "Album",
  albumMbid: null,
  albumArtUrl: null,
  artistImages: null,
  bio: null,
  positionMs: 20_000,
  durationMs: 120_000,
  playState: "playing",
  audioFormat: null,
  source: null,
  ...overrides,
});

describe("display playback", () => {
  it("advances only when playing and clamps at duration", () => {
    expect(playbackPosition(track(), 1000, 4000)).toBe(23_000);
    expect(playbackPosition(track({ playState: "paused" }), 1000, 4000)).toBe(
      20_000
    );
    expect(playbackPosition(track({ positionMs: 119_000 }), 1000, 4000)).toBe(
      120_000
    );
  });
  it("handles missing track and unknown duration", () => {
    expect(playbackPosition(null, 0, 1000)).toBe(0);
    expect(playbackPosition(track({ durationMs: 0 }), 1000, 4000)).toBe(23_000);
    expect(formatTime(-200)).toBe("0:00");
  });
  it("detects track changes, including album changes", () => {
    expect(trackIdentity(track())).not.toBe(
      trackIdentity(track({ trackName: "Other" }))
    );
    expect(trackIdentity(track())).not.toBe(
      trackIdentity(track({ albumName: "Other" }))
    );
    expect(trackIdentity(null)).toBe("__idle__");
  });
});
