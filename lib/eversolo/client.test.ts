import { describe, it, expect, vi, beforeEach } from "vitest";
import { EversoloClient } from "./client";

function mockFetch(data: unknown, ok = true) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok,
    json: async () => data,
  } as Response);
}

describe("EversoloClient", () => {
  let client: EversoloClient;

  beforeEach(() => {
    client = new EversoloClient("192.168.1.1");
    vi.restoreAllMocks();
  });

  describe("getState", () => {
    it("parses track from playingMusic path", async () => {
      mockFetch({
        state: 3,
        duration: 240000,
        position: 60000,
        playingMusic: {
          title: "Creep",
          artist: "Radiohead",
          album: "Pablo Honey",
          albumArtBig: "http://example.com/art.jpg",
          extension: "flac",
          sampleRate: "44100",
          bits: "16",
          channels: 2,
        },
      });

      const { track, playState } = await client.getState();

      expect(playState).toBe("playing");
      expect(track).toMatchObject({
        title: "Creep",
        artist: "Radiohead",
        album: "Pablo Honey",
        durationMs: 240000,
        positionMs: 60000,
        albumArtUrl: "http://example.com/art.jpg",
        audioFormat: {
          extension: "flac",
          sampleRate: "44100",
          bits: "16",
          channels: 2,
        },
      });
    });

    it("falls back to everSoloPlayInfo when playingMusic is absent", async () => {
      mockFetch({
        state: 3,
        duration: 180000,
        position: 30000,
        everSoloPlayInfo: {
          everSoloPlayAudioInfo: {
            songName: "OK Computer",
            artistName: "Radiohead",
            albumName: "OK Computer",
            albumArt: "http://example.com/art2.jpg",
          },
        },
      });

      const { track, playState } = await client.getState();

      expect(playState).toBe("playing");
      expect(track).toMatchObject({
        title: "OK Computer",
        artist: "Radiohead",
        album: "OK Computer",
        albumArtUrl: "http://example.com/art2.jpg",
        audioFormat: null,
      });
    });

    it("uses everSoloPlayAudioInfo when playingMusic has a streamId (Qobuz Connect)", async () => {
      mockFetch({
        state: 3,
        duration: 331377,
        position: 322419,
        playingMusic: {
          title: "Why so Serious? (Album Version)",
          artist: "Hans Zimmer",
          album: "The Dark Knight",
          albumArtBig:
            "https://static.qobuz.com/images/covers/90/59/art_600.jpg",
          extension: "FLAC",
          sampleRate: "44.1 kHz",
          bits: "16",
          channels: 2,
          streamId: "qobuz",
        },
        everSoloPlayInfo: {
          everSoloPlayAudioInfo: {
            songName: "Nightjar",
            artistName: "David Gray",
            albumName: "Nightjar",
            albumUrl:
              "https://static.qobuz.com/images/covers/cx/37/nightjar_600.jpg",
          },
        },
      });

      const { track } = await client.getState();

      // Must use everSoloPlayAudioInfo for metadata (authoritative for streaming)
      expect(track?.title).toBe("Nightjar");
      expect(track?.artist).toBe("David Gray");
      expect(track?.album).toBe("Nightjar");
      // Use everSoloPlayAudioInfo art — playingMusic art belongs to a different track
      expect(track?.albumArtUrl).toBe(
        "https://static.qobuz.com/images/covers/cx/37/nightjar_600.jpg"
      );
      // And keep audio format from playingMusic
      expect(track?.audioFormat).toMatchObject({
        extension: "FLAC",
        sampleRate: "44.1 kHz",
        bits: "16",
        channels: 2,
      });
    });

    it("uses playingMusic for Radio Paradise when alternate audio info is empty", async () => {
      mockFetch({
        state: 3,
        duration: 396377,
        position: 44711,
        playingMusic: {
          title: "Unbroken Chain",
          artist: "Grateful Dead",
          album: "From The Mars Hotel",
          albumArtBig: "https://img.radioparadise.com/covers/l/28141.jpg",
          streamId: "radioparadise",
          extension: "flac",
        },
        everSoloPlayInfo: {
          everSoloPlayAudioInfo: { songName: "", albumUrl: "" },
        },
      });

      const { track, playState } = await client.getState();
      expect(playState).toBe("playing");
      expect(track).toMatchObject({
        title: "Unbroken Chain",
        artist: "Grateful Dead",
        album: "From The Mars Hotel",
        albumArtUrl: "https://img.radioparadise.com/covers/l/28141.jpg",
        source: "radioparadise",
      });
    });

    it("returns null track when neither path has data", async () => {
      mockFetch({ state: 0 });

      const { track, playState } = await client.getState();

      expect(track).toBeNull();
      expect(playState).toBe("idle");
    });

    it("maps state 4 to paused", async () => {
      mockFetch({
        state: 4,
        playingMusic: { title: "Song", artist: "Artist", album: "" },
      });

      const { playState } = await client.getState();
      expect(playState).toBe("paused");
    });

    it("throws on HTTP error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);

      await expect(client.getState()).rejects.toThrow("HTTP 503");
    });
  });

  describe("isArtistInLibrary", () => {
    it("returns true when total > 0", async () => {
      mockFetch({ total: 3 });
      expect(await client.isArtistInLibrary("Radiohead")).toBe(true);
    });

    it("returns false when total is 0", async () => {
      mockFetch({ total: 0 });
      expect(await client.isArtistInLibrary("Unknown Artist")).toBe(false);
    });

    it("returns false on HTTP error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);
      expect(await client.isArtistInLibrary("Radiohead")).toBe(false);
    });

    it("returns false on network failure", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Network error")
      );
      expect(await client.isArtistInLibrary("Radiohead")).toBe(false);
    });
  });

  describe("control", () => {
    it("posts to the correct endpoint", async () => {
      const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.control("playOrPause");

      expect(spy).toHaveBeenCalledWith(
        "http://192.168.1.1:9529/ZidooMusicControl/v2/playOrPause",
        { method: "POST", signal: expect.any(AbortSignal) }
      );
    });

    it("throws on HTTP error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(client.control("playNext")).rejects.toThrow("HTTP 500");
    });
  });
});
