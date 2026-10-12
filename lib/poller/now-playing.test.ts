import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNowPlayingPipeline, NOW_PLAYING_KEY } from "./now-playing";

// No vi.mock() needed — deps are injected directly into the factory.

const makeClients = () => ({
  eversolo: { getState: vi.fn() },
  lastfm: { getArtistInfo: vi.fn() },
  musicBrainz: { searchArtist: vi.fn(), searchRelease: vi.fn() },
  fanartTV: { getArtistImages: vi.fn() },
  coverArt: { getAlbumArt: vi.fn(), getAlbumArtByReleaseGroup: vi.fn() },
});

const makeRedis = () => ({ setex: vi.fn(), del: vi.fn() });

const playingState = () => ({
  track: {
    title: "Creep",
    artist: "Radiohead",
    album: "Pablo Honey",
    durationMs: 238000,
    positionMs: 42000,
    albumArtUrl: null,
    audioFormat: null,
  },
  playState: "playing" as const,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NowPlayingPipeline", () => {
  it("deletes Redis key when nothing is playing", async () => {
    const c = makeClients();
    const r = makeRedis();
    c.eversolo.getState.mockResolvedValue({ track: null, playState: "idle" });

    createNowPlayingPipeline(c, r).start();
    await vi.waitFor(() => expect(r.del).toHaveBeenCalled());

    expect(r.del).toHaveBeenCalledWith(NOW_PLAYING_KEY);
    expect(r.setex).not.toHaveBeenCalled();
  });

  it("writes enriched track data to Redis when a song is playing", async () => {
    const c = makeClients();
    const r = makeRedis();
    c.eversolo.getState.mockResolvedValue(playingState());
    c.lastfm.getArtistInfo.mockResolvedValue({
      bio: "Radiohead are a band.",
      tags: [],
      listeners: 0,
    });
    c.musicBrainz.searchArtist.mockResolvedValue("mbid-rh");
    c.musicBrainz.searchRelease.mockResolvedValue(null);
    c.fanartTV.getArtistImages.mockResolvedValue(null);
    c.coverArt.getAlbumArt.mockResolvedValue(null);
    c.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

    createNowPlayingPipeline(c, r).start();
    await vi.waitFor(() => expect(r.setex).toHaveBeenCalled());

    const [key, ttl, json] = r.setex.mock.calls[0];
    const stored = JSON.parse(json);
    expect(key).toBe(NOW_PLAYING_KEY);
    expect(ttl).toBe(30);
    expect(stored.trackName).toBe("Creep");
    expect(stored.artistName).toBe("Radiohead");
    expect(stored.positionMs).toBe(42000);
    expect(stored.durationMs).toBe(238000);
    expect(stored.playState).toBe("playing");
  });

  it("skips enrichment on subsequent polls for the same track", async () => {
    const c = makeClients();
    const r = makeRedis();
    c.eversolo.getState.mockResolvedValue(playingState());
    c.lastfm.getArtistInfo.mockResolvedValue(null);
    c.musicBrainz.searchArtist.mockResolvedValue(null);
    c.musicBrainz.searchRelease.mockResolvedValue(null);
    c.fanartTV.getArtistImages.mockResolvedValue(null);
    c.coverArt.getAlbumArt.mockResolvedValue(null);
    c.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

    const pipeline = createNowPlayingPipeline(c, r);
    pipeline.start();
    await vi.waitFor(() => expect(r.setex).toHaveBeenCalledTimes(1));

    // Force a second poll for the same track
    pipeline.triggerPoll();
    await vi.waitFor(() => expect(r.setex).toHaveBeenCalledTimes(2));

    // Enrichment (Last.FM) called only once despite two polls
    expect(c.lastfm.getArtistInfo).toHaveBeenCalledTimes(1);
  });

  it("re-enriches when the track changes between polls", async () => {
    const c = makeClients();
    const r = makeRedis();
    c.eversolo.getState
      .mockResolvedValueOnce(playingState())
      .mockResolvedValue({
        track: {
          ...playingState().track,
          title: "Karma Police",
          artist: "Radiohead",
        },
        playState: "playing" as const,
      });
    c.lastfm.getArtistInfo.mockResolvedValue(null);
    c.musicBrainz.searchArtist.mockResolvedValue(null);
    c.musicBrainz.searchRelease.mockResolvedValue(null);
    c.fanartTV.getArtistImages.mockResolvedValue(null);
    c.coverArt.getAlbumArt.mockResolvedValue(null);
    c.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

    const pipeline = createNowPlayingPipeline(c, r);
    pipeline.start();
    await vi.waitFor(() => expect(r.setex).toHaveBeenCalledTimes(1));

    pipeline.triggerPoll();
    await vi.waitFor(() => expect(r.setex).toHaveBeenCalledTimes(2));

    // Enrichment called twice — once per track
    expect(c.lastfm.getArtistInfo).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous track through a brief gap during a skip", async () => {
    vi.useFakeTimers();
    try {
      const c = makeClients();
      const r = makeRedis();
      c.eversolo.getState
        .mockResolvedValueOnce(playingState())
        .mockResolvedValueOnce({ track: null, playState: "idle" })
        .mockResolvedValue({
          track: { ...playingState().track, title: "Karma Police" },
          playState: "playing",
        });
      c.lastfm.getArtistInfo.mockResolvedValue(null);
      c.musicBrainz.searchArtist.mockResolvedValue(null);
      c.musicBrainz.searchRelease.mockResolvedValue(null);
      c.fanartTV.getArtistImages.mockResolvedValue(null);
      c.coverArt.getAlbumArt.mockResolvedValue(null);
      c.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

      const pipeline = createNowPlayingPipeline(c, r);
      pipeline.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(r.setex).toHaveBeenCalledTimes(1);

      pipeline.triggerPoll();
      await vi.advanceTimersByTimeAsync(300);
      expect(r.del).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(3_000);
      expect(r.del).not.toHaveBeenCalled();
      expect(JSON.parse(r.setex.mock.lastCall?.[2] as string).trackName).toBe(
        "Karma Police"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the previous track after a genuine stop", async () => {
    vi.useFakeTimers();
    try {
      const c = makeClients();
      const r = makeRedis();
      c.eversolo.getState
        .mockResolvedValueOnce(playingState())
        .mockResolvedValue({ track: null, playState: "idle" });
      c.lastfm.getArtistInfo.mockResolvedValue(null);
      c.musicBrainz.searchArtist.mockResolvedValue(null);
      c.musicBrainz.searchRelease.mockResolvedValue(null);
      c.fanartTV.getArtistImages.mockResolvedValue(null);
      c.coverArt.getAlbumArt.mockResolvedValue(null);
      c.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

      const pipeline = createNowPlayingPipeline(c, r);
      pipeline.start();
      await vi.advanceTimersByTimeAsync(0);

      pipeline.triggerPoll();
      await vi.advanceTimersByTimeAsync(300);
      expect(r.del).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(3_000);
      expect(r.del).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(3_000);
      expect(r.del).toHaveBeenCalledWith(NOW_PLAYING_KEY);
    } finally {
      vi.useRealTimers();
    }
  });
});
