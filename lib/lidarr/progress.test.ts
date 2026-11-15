import { expect, it, vi } from "vitest";
import { getReleaseProgress } from "./progress";

vi.mock("@/lib/redis", async () => ({
  redis: (
    await import("@/lib/utils/redis-snapshot.test-fixture")
  ).createTestRedis(),
}));

it("matches queue and search progress by album ID and prefers completed imports", async () => {
  vi.stubEnv("LIDARR_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => ({
      ok: true,
      json: async () => {
        switch (url.pathname) {
          case "/api/v1/album":
            return [
              { id: 1, foreignAlbumId: "queued", monitored: true },
              { id: 2, foreignAlbumId: "downloading" },
              { id: 3, foreignAlbumId: "failed" },
              {
                id: 4,
                foreignAlbumId: "imported",
                statistics: { trackFileCount: 10, trackCount: 10 },
              },
            ];
          case "/api/v1/queue":
            return {
              records: [
                { albumId: 2, status: "downloading" },
                { albumId: 3, trackedDownloadState: "importFailed" },
                { albumId: 4, trackedDownloadState: "importFailed" },
              ],
            };
          default:
            return [
              {
                name: "AlbumSearch",
                status: "queued",
                body: { albumIds: [1] },
              },
            ];
        }
      },
    }))
  );

  try {
    const status = await getReleaseProgress();
    expect(status("queued")).toBe("queued");
    expect(status("downloading")).toBe("downloading");
    expect(status("failed")).toBe("import-failed");
    expect(status("imported")).toBe("downloaded");
    expect(status("unknown")).toBe("not-tracked");
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
