import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/clients", () => ({
  clients: {
    lastfm: {
      getTopArtists: vi.fn(),
      getTopTags: vi.fn(),
      getSimilarArtists: vi.fn(),
      getArtistInfo: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recommendation: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { clients } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { startRecommendationsJob } from "./recommendations";

const lastfm = clients.lastfm as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const prismaMock = prisma as unknown as {
  recommendation: Record<string, ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LASTFM_USERNAME = "testuser";
});

describe("startRecommendationsJob", () => {
  it("writes recommendations to Prisma when data is stale", async () => {
    prismaMock.recommendation.findFirst.mockResolvedValue(null); // no data → stale
    prismaMock.$transaction.mockResolvedValue(undefined);

    lastfm.getTopArtists.mockResolvedValue([
      { name: "Radiohead", playCount: 500, rank: 1 },
    ]);
    lastfm.getTopTags.mockResolvedValue([
      { name: "alternative rock", count: 10 },
    ]);
    lastfm.getSimilarArtists.mockResolvedValue([
      { name: "Portishead", match: 0.8 },
    ]);
    lastfm.getArtistInfo.mockResolvedValue({ tags: ["alternative rock"] });

    startRecommendationsJob();
    await vi.waitFor(() => expect(prismaMock.$transaction).toHaveBeenCalled());

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("skips the run when recommendations are less than 20 hours old", async () => {
    prismaMock.recommendation.findFirst.mockResolvedValue({
      createdAt: new Date(), // just now — not stale
    });

    startRecommendationsJob();
    await vi.waitFor(() =>
      expect(prismaMock.recommendation.findFirst).toHaveBeenCalled()
    );

    expect(lastfm.getTopArtists).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
