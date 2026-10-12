import { describe, it, expect, vi, beforeEach } from "vitest";
import { MusicBrainzClient } from "./client";

function mockFetch(data: unknown, ok = true) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok,
    json: async () => data,
  } as Response);
}

describe("MusicBrainzClient", () => {
  let client: MusicBrainzClient;

  beforeEach(() => {
    client = new MusicBrainzClient(0);
    vi.restoreAllMocks();
  });

  describe("getRecentReleases", () => {
    it("returns releases after the since date", async () => {
      mockFetch({
        "release-groups": [
          {
            id: "rg-1",
            title: "OK Computer",
            "first-release-date": "2024-06-01",
            "primary-type": "Album",
          },
        ],
      });

      const releases = await client.getRecentReleases(
        "artist-mbid",
        new Date("2024-01-01")
      );

      expect(releases).toEqual([
        {
          mbid: "rg-1",
          title: "OK Computer",
          date: "2024-06-01",
          type: "Album",
        },
      ]);
    });

    it("filters out releases before the since date", async () => {
      mockFetch({
        "release-groups": [
          {
            id: "rg-old",
            title: "Pablo Honey",
            "first-release-date": "1993-02-22",
            "primary-type": "Album",
          },
          {
            id: "rg-new",
            title: "SMILE",
            "first-release-date": "2024-09-27",
            "primary-type": "Album",
          },
        ],
      });

      const releases = await client.getRecentReleases(
        "artist-mbid",
        new Date("2024-01-01")
      );

      expect(releases).toEqual([
        { mbid: "rg-new", title: "SMILE", date: "2024-09-27", type: "Album" },
      ]);
    });

    it("returns empty array when no releases are within range", async () => {
      mockFetch({
        "release-groups": [
          {
            id: "rg-old",
            title: "Pablo Honey",
            "first-release-date": "1993-02-22",
            "primary-type": "Album",
          },
        ],
      });

      const releases = await client.getRecentReleases(
        "artist-mbid",
        new Date("2024-01-01")
      );

      expect(releases).toEqual([]);
    });

    it("propagates API errors so a refresh cannot erase saved releases", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);

      await expect(
        client.getRecentReleases("artist-mbid", new Date("2024-01-01"))
      ).rejects.toThrow("MusicBrainz API error: 503");
    });
  });

  describe("searchArtist", () => {
    it("returns null when no artists are found", async () => {
      mockFetch({ artists: [] });

      const mbid = await client.searchArtist("no-such-artist-xyz");

      expect(mbid).toBeNull();
    });

    it("returns the MBID of the best matching artist", async () => {
      mockFetch({
        artists: [
          {
            id: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            name: "Radiohead",
            score: 100,
          },
          { id: "other-mbid", name: "Radiohead tribute", score: 60 },
        ],
      });

      const mbid = await client.searchArtist("Radiohead");

      expect(mbid).toBe("a74b1b7f-71a5-4011-9441-d0b5e4122711");
    });
  });

  describe("getReleaseGroupYear", () => {
    it("returns the year from first-release-date", async () => {
      mockFetch({
        "first-release-date": "1998-09-22",
        title: "Dizzy Up the Girl",
      });

      const year = await client.getReleaseGroupYear("some-mbid");

      expect(year).toBe(1998);
    });

    it("returns null when first-release-date is missing", async () => {
      mockFetch({ "first-release-date": "", title: "Unknown" });

      const year = await client.getReleaseGroupYear("some-mbid");

      expect(year).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch({}, false);

      const year = await client.getReleaseGroupYear("some-mbid");

      expect(year).toBeNull();
    });
  });

  describe("searchRelease", () => {
    it("returns release-group MBID for matching artist and album", async () => {
      mockFetch({
        "release-groups": [
          { id: "rg-ok-computer", score: 100 },
          { id: "rg-other", score: 60 },
        ],
      });

      const mbid = await client.searchRelease("Radiohead", "OK Computer");

      expect(mbid).toBe("rg-ok-computer");
    });

    it("returns null when no release-groups are found", async () => {
      mockFetch({ "release-groups": [] });

      const mbid = await client.searchRelease("Unknown", "Unknown Album");

      expect(mbid).toBeNull();
    });
  });
});
