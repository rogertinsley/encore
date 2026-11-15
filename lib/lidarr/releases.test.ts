import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLidarrAlbums,
  requestReleaseSearch,
  statusForRelease,
} from "./releases";

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

  it("monitors an upcoming release without sending a search command", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 17, foreignAlbumId: mbid, monitored: false }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestReleaseSearch({
        mbid,
        title: "In Rainbows",
        artistName: "Radiohead",
        releaseDate: new Date(Date.now() + 86_400_000),
      })
    ).resolves.toMatch(/Monitored/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].pathname).toBe("/api/v1/album/monitor");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });

  it("collapses concurrent requests into one search for a released album", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 17, foreignAlbumId: mbid, monitored: true }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 37 }) });
    vi.stubGlobal("fetch", fetchMock);
    const release = {
      mbid,
      title: "In Rainbows",
      artistName: "Radiohead",
      releaseDate: new Date("2007-10-10"),
    };

    await Promise.all([
      requestReleaseSearch(release),
      requestReleaseSearch(release),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].body).toBe(
      JSON.stringify({
        name: "AlbumSearch",
        albumIds: [17],
      })
    );
  });
});
