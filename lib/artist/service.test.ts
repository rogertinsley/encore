import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistPageData } from "./service";

const mockClients = {
  lastfm: {
    getArtistInfo: vi.fn(),
    getTopTracks: vi.fn(),
    getTopAlbums: vi.fn(),
    getSimilarArtists: vi.fn(),
  },
  musicBrainz: {
    searchArtist: vi.fn(),
    getReleaseGroupYear: vi.fn(),
  },
  fanartTV: {
    getArtistImages: vi.fn(),
  },
  coverArt: {
    getAlbumArtByReleaseGroup: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClients.lastfm.getArtistInfo.mockResolvedValue({
    name: "Radiohead",
    mbid: "mbid-rh",
    bio: "A band.",
    tags: ["alternative rock"],
    listeners: 5000000,
    userPlayCount: 42,
  });
  mockClients.lastfm.getTopTracks.mockResolvedValue([{ name: "Creep" }]);
  mockClients.lastfm.getTopAlbums.mockResolvedValue([]);
  mockClients.lastfm.getSimilarArtists.mockResolvedValue([]);
  mockClients.musicBrainz.searchArtist.mockResolvedValue("mbid-rh");
  mockClients.fanartTV.getArtistImages.mockResolvedValue({
    background: "http://example.com/bg.jpg",
    thumbnail: "http://example.com/thumb.jpg",
  });
});

describe("getArtistPageData", () => {
  it("assembles full artist data from all clients", async () => {
    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.name).toBe("Radiohead");
    expect(data.mbid).toBe("mbid-rh");
    expect(data.bio).toBe("A band.");
    expect(data.tags).toEqual(["alternative rock"]);
    expect(data.listeners).toBe(5000000);
    expect(data.userPlayCount).toBe(42);
    expect(data.artistImages?.background).toBe("http://example.com/bg.jpg");
    expect(data.topTracks).toEqual([{ name: "Creep" }]);
  });

  it("falls back to MusicBrainz mbid when Last.FM has no mbid", async () => {
    mockClients.lastfm.getArtistInfo.mockResolvedValue({
      name: "Radiohead",
      mbid: null,
      bio: null,
      tags: [],
      listeners: 0,
      userPlayCount: null,
    });
    mockClients.musicBrainz.searchArtist.mockResolvedValue("mbid-from-mb");

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.mbid).toBe("mbid-from-mb");
  });

  it("returns null artistImages when MusicBrainz finds no MBID", async () => {
    mockClients.musicBrainz.searchArtist.mockResolvedValue(null);

    const data = await getArtistPageData(
      "Unknown Artist",
      mockClients,
      "testuser"
    );

    expect(data.artistImages).toBeNull();
    expect(mockClients.fanartTV.getArtistImages).not.toHaveBeenCalled();
  });

  it("enriches albums with cover art and year", async () => {
    mockClients.lastfm.getTopAlbums.mockResolvedValue([
      { name: "OK Computer", mbid: "album-mbid", rank: 1, imageUrl: null },
    ]);
    mockClients.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(
      "http://example.com/cover.jpg"
    );
    mockClients.musicBrainz.getReleaseGroupYear.mockResolvedValue(1997);

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.topAlbums[0].coverArtUrl).toBe("http://example.com/cover.jpg");
    expect(data.topAlbums[0].year).toBe(1997);
  });

  it("falls back to Last.FM imageUrl when cover art is unavailable", async () => {
    mockClients.lastfm.getTopAlbums.mockResolvedValue([
      {
        name: "OK Computer",
        mbid: "album-mbid",
        rank: 1,
        imageUrl: "http://lastfm.com/img.jpg",
      },
    ]);
    mockClients.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);
    mockClients.musicBrainz.getReleaseGroupYear.mockResolvedValue(null);

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.topAlbums[0].coverArtUrl).toBe("http://lastfm.com/img.jpg");
  });

  it("caps similar artists at 8", async () => {
    mockClients.lastfm.getSimilarArtists.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ name: `Artist ${i}` }))
    );

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.similarArtists).toHaveLength(8);
  });

  it("handles partial client failures gracefully", async () => {
    mockClients.lastfm.getTopTracks.mockRejectedValue(
      new Error("rate limited")
    );
    mockClients.musicBrainz.searchArtist.mockRejectedValue(
      new Error("timeout")
    );

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.topTracks).toEqual([]);
    expect(data.artistImages).toBeNull();
  });

  it("filters out Last.FM placeholder imageUrl when CoverArt returns null", async () => {
    const placeholderUrl =
      "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
    mockClients.lastfm.getTopAlbums.mockResolvedValue([
      {
        name: "OK Computer",
        mbid: "album-mbid",
        rank: 1,
        imageUrl: placeholderUrl,
      },
    ]);
    mockClients.coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);
    mockClients.musicBrainz.getReleaseGroupYear.mockResolvedValue(null);

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.topAlbums[0].coverArtUrl).toBeNull();
  });

  it("returns null coverArtUrl only for albums where CoverArt fails", async () => {
    mockClients.lastfm.getTopAlbums.mockResolvedValue([
      { name: "OK Computer", mbid: "mbid-ok", rank: 1, imageUrl: null },
      { name: "Kid A", mbid: "mbid-kida", rank: 2, imageUrl: null },
    ]);
    mockClients.coverArt.getAlbumArtByReleaseGroup
      .mockResolvedValueOnce("http://example.com/ok.jpg") // OK Computer succeeds
      .mockRejectedValueOnce(new Error("not found")); // Kid A fails
    mockClients.musicBrainz.getReleaseGroupYear.mockResolvedValue(null);

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.topAlbums[0].coverArtUrl).toBe("http://example.com/ok.jpg");
    expect(data.topAlbums[1].coverArtUrl).toBeNull();
  });

  it("returns null artistImages when MusicBrainz finds MBID but FanartTV fails", async () => {
    mockClients.musicBrainz.searchArtist.mockResolvedValue("mbid-rh");
    mockClients.fanartTV.getArtistImages.mockRejectedValue(
      new Error("fanart timeout")
    );

    const data = await getArtistPageData("Radiohead", mockClients, "testuser");

    expect(data.artistImages).toBeNull();
    expect(data.mbid).toBe("mbid-rh"); // MBID still populated
  });
});
