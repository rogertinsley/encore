import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/editorial", () => ({
  generateLeadReview: vi.fn(),
  generateWeeklyDigest: vi.fn(),
  generateAlbumReview: vi.fn(),
  generateArtistSpotlight: vi.fn(),
}));

vi.mock("@/lib/news/service", () => ({
  getPersonalisedNews: vi.fn(),
}));

import {
  generateLeadReview,
  generateWeeklyDigest,
  generateAlbumReview,
  generateArtistSpotlight,
} from "@/lib/ai/editorial";
import { getPersonalisedNews } from "@/lib/news/service";
import { buildEditorialData } from "./service";
import type { RecentTrack } from "@/lib/lastfm/types";
import type { TopArtist } from "@/lib/lastfm/types";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

const mockAI = {
  generateLeadReview: generateLeadReview as ReturnType<typeof vi.fn>,
  generateWeeklyDigest: generateWeeklyDigest as ReturnType<typeof vi.fn>,
  generateAlbumReview: generateAlbumReview as ReturnType<typeof vi.fn>,
  generateArtistSpotlight: generateArtistSpotlight as ReturnType<typeof vi.fn>,
  getPersonalisedNews: getPersonalisedNews as ReturnType<typeof vi.fn>,
};

function makeClients() {
  return {
    musicBrainz: { searchArtist: vi.fn().mockResolvedValue(null) },
    fanartTV: { getArtistImages: vi.fn().mockResolvedValue(null) },
  };
}

function makeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
  };
}

function makeTrack(artistName: string, albumName: string): RecentTrack {
  return {
    trackName: "Song",
    artistName,
    albumName,
    albumArtUrl: null,
    scrobbledAt: null,
  };
}

function makeTopArtist(name: string): TopArtist {
  return { name, playCount: 100, rank: 1 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAI.generateLeadReview.mockResolvedValue({
    review: "Great album",
    pullQuote: "A masterpiece",
  });
  mockAI.generateWeeklyDigest.mockResolvedValue("A fine week in music.");
  mockAI.generateAlbumReview.mockResolvedValue({
    review: "Solid record",
    pullQuote: "Worth your time",
  });
  mockAI.generateArtistSpotlight.mockResolvedValue("Interesting fact.");
  mockAI.getPersonalisedNews.mockResolvedValue([]);
});

describe("buildEditorialData", () => {
  it("returns null lead when nowPlaying is null", async () => {
    const data = await buildEditorialData(
      null,
      [],
      [],
      makeClients(),
      makeRedis()
    );
    expect(data.lead).toBeNull();
    expect(mockAI.generateLeadReview).not.toHaveBeenCalled();
  });

  it("returns a lead review for the now-playing artist", async () => {
    const nowPlaying = {
      artistName: "Radiohead",
      albumName: "OK Computer",
      bio: "A band from Oxford.",
      albumArtUrl: "http://art.jpg",
      artistImages: { background: "http://bg.jpg" },
    } as unknown as EnrichedNowPlaying;

    const data = await buildEditorialData(
      nowPlaying,
      [],
      [],
      makeClients(),
      makeRedis()
    );

    expect(mockAI.generateLeadReview).toHaveBeenCalledWith(
      "Radiohead",
      "OK Computer",
      [],
      "A band from Oxford."
    );
    expect(data.lead).toMatchObject({
      artistName: "Radiohead",
      albumName: "OK Computer",
      review: "Great album",
      pullQuote: "A masterpiece",
      backgroundUrl: "http://bg.jpg",
      albumArtUrl: "http://art.jpg",
    });
  });

  it("derives top albums from recent tracks and generates album reviews", async () => {
    const tracks = [
      makeTrack("Portishead", "Dummy"),
      makeTrack("Portishead", "Dummy"),
      makeTrack("Portishead", "Dummy"),
      makeTrack("Massive Attack", "Mezzanine"),
    ];

    const data = await buildEditorialData(
      null,
      tracks,
      [],
      makeClients(),
      makeRedis()
    );

    expect(mockAI.generateAlbumReview).toHaveBeenCalledWith(
      "Portishead",
      "Dummy"
    );
    expect(mockAI.generateAlbumReview).toHaveBeenCalledWith(
      "Massive Attack",
      "Mezzanine"
    );
    expect(data.albumReviews).toHaveLength(2);
    expect(data.albumReviews[0].artistName).toBe("Portishead");
  });

  it("returns null for sections when AI fails", async () => {
    const nowPlaying = {
      artistName: "Björk",
      albumName: "Homogenic",
      bio: null,
      albumArtUrl: null,
      artistImages: {},
    } as unknown as EnrichedNowPlaying;

    mockAI.generateLeadReview.mockRejectedValue(new Error("OpenAI down"));
    mockAI.generateWeeklyDigest.mockRejectedValue(new Error("OpenAI down"));

    const data = await buildEditorialData(
      nowPlaying,
      [],
      [makeTopArtist("Björk")],
      makeClients(),
      makeRedis()
    );

    expect(data.lead).toBeNull();
    expect(data.weeklyDigest).toBeNull();
  });

  it("picks a spotlight artist that is different from the lead", async () => {
    const nowPlaying = {
      artistName: "Radiohead",
      albumName: null,
      bio: null,
      albumArtUrl: null,
      artistImages: {},
    } as unknown as EnrichedNowPlaying;

    const tracks = [
      makeTrack("Radiohead", "Kid A"),
      makeTrack("Portishead", "Dummy"),
    ];

    await buildEditorialData(
      nowPlaying,
      tracks,
      [],
      makeClients(),
      makeRedis()
    );

    expect(mockAI.generateArtistSpotlight).toHaveBeenCalledWith("Portishead");
  });

  it("includes news from getPersonalisedNews", async () => {
    const newsItem = {
      title: "Radiohead tour",
      url: "http://news.com",
      source: "NME",
      publishedAt: null,
      summary: null,
      matchedArtist: "Radiohead",
    };
    mockAI.getPersonalisedNews.mockResolvedValue([newsItem]);

    const data = await buildEditorialData(
      null,
      [],
      [makeTopArtist("Radiohead")],
      makeClients(),
      makeRedis()
    );

    expect(data.news).toEqual([newsItem]);
  });
});
