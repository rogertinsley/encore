import { describe, it, expect, vi } from "vitest";
import { NewReleasesService } from "./service";

const SINCE = new Date("2024-01-01");

function makeLastFM(
  topArtists: { name: string; playCount: number; rank: number }[]
) {
  return { getTopArtists: vi.fn().mockResolvedValue(topArtists) };
}

function makeMusicBrainz(
  mbidMap: Record<string, string | null>,
  releasesMap: Record<
    string,
    { mbid: string; title: string; date: string; type: string }[]
  >
) {
  return {
    searchArtist: vi
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(mbidMap[name] ?? null)
      ),
    getRecentReleases: vi
      .fn()
      .mockImplementation((mbid: string) =>
        Promise.resolve(releasesMap[mbid] ?? [])
      ),
  };
}

describe("NewReleasesService", () => {
  it("returns empty array when no releases fall within the date window", async () => {
    const lastfm = makeLastFM([
      { name: "Radiohead", playCount: 1000, rank: 1 },
    ]);
    const musicBrainz = makeMusicBrainz(
      { Radiohead: "mbid-rh" },
      { "mbid-rh": [] }
    );

    const service = new NewReleasesService(lastfm, musicBrainz);
    const releases = await service.getNewReleases("testuser", SINCE);

    expect(releases).toEqual([]);
  });

  it("skips artists when MBID cannot be resolved", async () => {
    const lastfm = makeLastFM([
      { name: "Unknown Artist", playCount: 500, rank: 1 },
    ]);
    const musicBrainz = makeMusicBrainz({ "Unknown Artist": null }, {});

    const service = new NewReleasesService(lastfm, musicBrainz);
    const releases = await service.getNewReleases("testuser", SINCE);

    expect(releases).toEqual([]);
  });

  it("returns releases for resolved artists even when some fail to resolve", async () => {
    const lastfm = makeLastFM([
      { name: "Radiohead", playCount: 1000, rank: 1 },
      { name: "Unknown Artist", playCount: 50, rank: 2 },
    ]);
    const musicBrainz = makeMusicBrainz(
      { Radiohead: "mbid-rh", "Unknown Artist": null },
      {
        "mbid-rh": [
          { mbid: "rg-1", title: "SMILE", date: "2024-06-01", type: "Album" },
        ],
      }
    );

    const service = new NewReleasesService(lastfm, musicBrainz);
    const releases = await service.getNewReleases("testuser", SINCE);

    expect(releases).toHaveLength(1);
    expect(releases[0].artistName).toBe("Radiohead");
  });

  it("deduplicates releases that appear under multiple artists", async () => {
    const lastfm = makeLastFM([
      { name: "Radiohead", playCount: 1000, rank: 1 },
      { name: "Thom Yorke", playCount: 400, rank: 2 },
    ]);
    const sharedRelease = {
      mbid: "shared-rg",
      title: "Collab Album",
      date: "2024-05-01",
      type: "Album",
    };
    const musicBrainz = makeMusicBrainz(
      { Radiohead: "mbid-rh", "Thom Yorke": "mbid-ty" },
      { "mbid-rh": [sharedRelease], "mbid-ty": [sharedRelease] }
    );

    const service = new NewReleasesService(lastfm, musicBrainz);
    const releases = await service.getNewReleases("testuser", SINCE);

    const dupes = releases.filter((r) => r.mbid === "shared-rg");
    expect(dupes).toHaveLength(1);
  });

  it("returns releases sorted by artist play count descending", async () => {
    const lastfm = makeLastFM([
      { name: "Blur", playCount: 200, rank: 2 },
      { name: "Radiohead", playCount: 1000, rank: 1 },
    ]);
    const musicBrainz = makeMusicBrainz(
      { Radiohead: "mbid-rh", Blur: "mbid-blur" },
      {
        "mbid-rh": [
          { mbid: "rg-1", title: "SMILE", date: "2024-06-01", type: "Album" },
        ],
        "mbid-blur": [
          {
            mbid: "rg-2",
            title: "The Ballad of Darren",
            date: "2024-07-01",
            type: "Album",
          },
        ],
      }
    );

    const service = new NewReleasesService(lastfm, musicBrainz);
    const releases = await service.getNewReleases("testuser", SINCE);

    expect(releases.map((r) => r.artistName)).toEqual(["Radiohead", "Blur"]);
  });

  it("rejects an incomplete refresh when any artist lookup fails", async () => {
    const lastfm = makeLastFM([
      { name: "Radiohead", playCount: 1000, rank: 1 },
      { name: "Blur", playCount: 500, rank: 2 },
    ]);
    const musicBrainz = makeMusicBrainz({ Radiohead: "mbid-rh" }, {});
    musicBrainz.searchArtist.mockImplementation((name: string) =>
      name === "Blur"
        ? Promise.reject(new Error("upstream offline"))
        : Promise.resolve("mbid-rh")
    );

    await expect(
      new NewReleasesService(lastfm, musicBrainz).getNewReleases(
        "testuser",
        SINCE
      )
    ).rejects.toThrow("upstream offline");
  });
});
