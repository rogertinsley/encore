import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getLidarrArtistStatus, requestArtistAdd } from "./artists";

vi.mock("@/lib/redis", async () => ({
  redis: (
    await import("@/lib/utils/redis-snapshot.test-fixture")
  ).createTestRedis(),
}));

const artist = { id: 42, artistName: "Björk", foreignArtistId: "artist-id" };

beforeEach(() => vi.stubEnv("LIDARR_API_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockLidarr(...replies: unknown[]) {
  const fetchMock = vi.fn<(url: URL, options: RequestInit) => Promise<unknown>>(
    async () => ({ ok: true, json: async () => replies.shift() })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("adds the artist without monitoring or searching their albums", async () => {
  const fetchMock = mockLidarr(
    [artist],
    [],
    [
      {
        path: "/music",
        defaultQualityProfileId: 1,
        defaultMetadataProfileId: 2,
      },
    ],
    artist
  );

  await expect(requestArtistAdd(artist.artistName)).resolves.toMatchObject({
    ok: true,
    added: true,
  });

  const writes = fetchMock.mock.calls.filter(
    ([, options]) => options.method === "POST"
  );
  expect(writes).toHaveLength(1);
  expect(writes[0][0].pathname).toBe("/api/v1/artist");
  expect(JSON.parse(String(writes[0][1].body))).toMatchObject({
    foreignArtistId: artist.foreignArtistId,
    addOptions: { monitor: "none", searchForMissingAlbums: false },
  });
});

it("treats an existing artist as success without making a write", async () => {
  const fetchMock = mockLidarr([artist], [artist]);
  await expect(requestArtistAdd(artist.artistName)).resolves.toMatchObject({
    ok: true,
    added: false,
  });
  expect(
    fetchMock.mock.calls.every(([, options]) => options.method === "GET")
  ).toBe(true);
});

it("rejects ambiguous names before making any changes", async () => {
  const fetchMock = mockLidarr([
    artist,
    { ...artist, foreignArtistId: "another-id" },
  ]);
  await expect(requestArtistAdd(artist.artistName)).resolves.toMatchObject({
    ok: false,
    message: expect.stringContaining("Multiple artists match"),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("checks an existing artist by MusicBrainz ID before using the name", async () => {
  mockLidarr([artist], [artist], [artist]);
  await expect(
    getLidarrArtistStatus("Different spelling", artist.foreignArtistId)
  ).resolves.toBe(true);
  await expect(
    getLidarrArtistStatus(artist.artistName, "another-id")
  ).resolves.toBe(false);
  await expect(getLidarrArtistStatus(artist.artistName, null)).resolves.toBe(
    true
  );
});
