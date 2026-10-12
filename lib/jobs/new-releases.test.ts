import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/clients", () => ({
  clients: {
    lastfm: { getTopArtists: vi.fn() },
    musicBrainz: { searchArtist: vi.fn(), getRecentReleases: vi.fn() },
    coverArt: { getAlbumArtByReleaseGroup: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newRelease: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { clients } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { startNewReleasesJob } from "./new-releases";

const lastfm = clients.lastfm as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const coverArt = clients.coverArt as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const prismaMock = prisma as unknown as {
  newRelease: Record<string, ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LASTFM_USERNAME = "testuser";
  process.env.NEW_RELEASES_DAYS_WINDOW = "90";
});

describe("startNewReleasesJob", () => {
  it("skips the run when releases are less than 20 hours old", async () => {
    prismaMock.newRelease.findFirst.mockResolvedValue({
      createdAt: new Date(),
    });

    startNewReleasesJob();
    await vi.waitFor(() =>
      expect(prismaMock.newRelease.findFirst).toHaveBeenCalled()
    );

    expect(lastfm.getTopArtists).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("writes new releases to Prisma when data is stale", async () => {
    prismaMock.newRelease.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue(undefined);

    lastfm.getTopArtists.mockResolvedValue([
      { name: "Radiohead", playCount: 500, rank: 1 },
    ]);
    // NewReleasesService will call musicBrainz internally via injected clients
    // — it finds no MBID so returns no releases; the job still runs the transaction
    vi.mocked(clients.musicBrainz.searchArtist).mockResolvedValue(null);
    coverArt.getAlbumArtByReleaseGroup.mockResolvedValue(null);

    startNewReleasesJob();
    await vi.waitFor(() => expect(prismaMock.$transaction).toHaveBeenCalled());

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("preserves saved releases when MusicBrainz fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.newRelease.findFirst.mockResolvedValue({
      createdAt: new Date(0),
    });
    lastfm.getTopArtists.mockResolvedValue([
      { name: "Radiohead", playCount: 500, rank: 1 },
    ]);
    vi.mocked(clients.musicBrainz.searchArtist).mockRejectedValue(
      new Error("MusicBrainz unavailable")
    );

    startNewReleasesJob();
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalled());

    expect(prismaMock.newRelease.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
