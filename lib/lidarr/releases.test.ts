import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLidarrAlbums,
  requestReleaseSearch,
  resolveArtistAlbumMbid,
  statusForRelease,
} from "./releases";

vi.mock("@/lib/redis", async () => ({
  redis: (
    await import("@/lib/utils/redis-snapshot.test-fixture")
  ).createTestRedis(),
}));

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
    expect(first).toEqual(second);
    expect(statusForRelease(mbid, first!)).toBe("unmonitored");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "X-Api-Key": "test-key",
    });
    expect(await getLidarrAlbums()).toEqual(first);
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
    ).resolves.toMatchObject({ status: "monitored" });

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
  it("registers an exact artist and searches only the requested release", async () => {
    const artist = {
      id: 5,
      artistName: "Radiohead",
      foreignArtistId: "artist-id",
    };
    const match = {
      id: 17,
      title: "In Rainbows",
      foreignAlbumId: mbid,
      artist,
      monitored: false,
    };
    const replies = [
      [],
      [match],
      [],
      [artist],
      [],
      [
        {
          path: "/music",
          defaultQualityProfileId: 1,
          defaultMetadataProfileId: 1,
        },
      ],
      artist,
      [match],
      [],
      [],
      { id: 37 },
    ];
    const fetchMock = vi.fn<
      (
        _url: URL,
        _options: RequestInit
      ) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
    >(async () => ({
      ok: true,
      json: async () => replies.shift(),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestReleaseSearch({
        mbid,
        title: match.title,
        artistName: artist.artistName,
        releaseDate: new Date("2007-10-10"),
      })
    ).resolves.toMatchObject({ status: "queued" });

    const writes = fetchMock.mock.calls
      .filter(([, options]) => options.method !== "GET")
      .map(([url, options]) => [
        url.pathname,
        JSON.parse(String(options.body)),
      ]);
    expect(writes).toEqual([
      [
        "/api/v1/artist",
        expect.objectContaining({
          addOptions: { monitor: "none", searchForMissingAlbums: false },
        }),
      ],
      ["/api/v1/album/monitor", { albumIds: [17], monitored: true }],
      ["/api/v1/command", { name: "AlbumSearch", albumIds: [17] }],
    ]);
  });
});

it("reconciles alternate album IDs only for a unique album by the same artist", () => {
  const album = { name: "Mr. Beast", mbid: "lastfm-release" };
  const artist = { foreignArtistId: "mogwai" };
  const library = new Map([
    [
      "release-group",
      { title: album.name, artist, foreignAlbumId: "release-group" },
    ],
    [
      "other-artist",
      {
        title: album.name,
        artist: { foreignArtistId: "other" },
        foreignAlbumId: "other-artist",
      },
    ],
  ]);

  expect(resolveArtistAlbumMbid(library, album, "mogwai")).toBe(
    "release-group"
  );
  expect(resolveArtistAlbumMbid(library, album, null)).toBe(album.mbid);
  library.set("another-edition", {
    title: album.name,
    artist,
    foreignAlbumId: "another-edition",
  });
  expect(resolveArtistAlbumMbid(library, album, "mogwai")).toBe(album.mbid);
  expect(
    resolveArtistAlbumMbid(
      library,
      { ...album, mbid: "release-group" },
      "mogwai"
    )
  ).toBe("release-group");
});
