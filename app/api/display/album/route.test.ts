import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients", () => ({
  clients: {
    musicBrainz: {
      searchRelease: vi.fn(),
      getReleaseGroupYear: vi.fn(),
    },
  },
}));
vi.mock("@/lib/utils/cache", () => ({
  withCache: vi.fn(
    (_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()
  ),
}));

import { clients } from "@/lib/clients";
import { GET } from "./route";

const mb = clients.musicBrainz as unknown as {
  searchRelease: ReturnType<typeof vi.fn>;
  getReleaseGroupYear: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("display album details", () => {
  it("returns a release year for the current album", async () => {
    mb.searchRelease.mockResolvedValue("release-group-id");
    mb.getReleaseGroupYear.mockResolvedValue(2025);
    const response = await GET(
      new Request(
        "http://localhost/api/display/album?artist=Bush&album=I%20Beat%20Loneliness"
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ year: 2025 });
    expect(mb.searchRelease).toHaveBeenCalledWith("Bush", "I Beat Loneliness");
  });

  it("leaves the panel usable when metadata is unavailable", async () => {
    mb.searchRelease.mockRejectedValue(new Error("offline"));
    const response = await GET(
      new Request(
        "http://localhost/api/display/album?artist=Bush&album=Unknown"
      )
    );
    expect(await response.json()).toEqual({ year: null });
  });

  it("rejects incomplete requests", async () => {
    const response = await GET(
      new Request("http://localhost/api/display/album?artist=Bush")
    );
    expect(response.status).toBe(400);
    expect(mb.searchRelease).not.toHaveBeenCalled();
  });
});
