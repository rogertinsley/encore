import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLidarrAlbums, statusForRelease } from "./releases";

const mbid = "A2A2D638-ACD1-4BAE-BFA2-3BC23942E7FE";

describe("Lidarr new-release status", () => {
  beforeEach(() => {
    process.env.LIDARR_URL = "http://lidarr:8686";
    process.env.LIDARR_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LIDARR_URL;
    delete process.env.LIDARR_API_KEY;
  });

  it("matches a MusicBrainz release group and maps download states", () => {
    const album = {
      foreignAlbumId: mbid,
      monitored: true,
      statistics: { trackCount: 10, trackFileCount: 0 },
    };
    const albums = new Map([[mbid.toLowerCase(), album]]);
    expect(statusForRelease(mbid, albums)).toBe("monitored");
    album.statistics.trackFileCount = 4;
    expect(statusForRelease(mbid, albums)).toBe("partial");
    album.statistics.trackFileCount = 10;
    expect(statusForRelease(mbid, albums)).toBe("downloaded");
    expect(statusForRelease(null, albums)).toBe("not-tracked");
    expect(statusForRelease("other", albums)).toBe("not-tracked");
  });

  it("uses a single authenticated request and caches the album list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ foreignAlbumId: mbid, monitored: false }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([
      getLidarrAlbums(),
      getLidarrAlbums(),
    ]);
    expect(first).toBe(second);
    expect(statusForRelease(mbid, first!)).toBe("unmonitored");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "X-Api-Key": "test-key",
    });
    expect(await getLidarrAlbums()).toBe(first);
  });
});
