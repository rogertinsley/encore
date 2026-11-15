import { afterEach, expect, it, vi } from "vitest";
import { PlexClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

it("reads the configured user's Plexamp music session and prefers playing over paused", async () => {
  const track = {
    type: "track",
    title: "Test track",
    grandparentTitle: "Test artist",
    parentTitle: "Test album",
    duration: 180_000,
    viewOffset: 42_000,
    User: { title: "Listener" },
    Player: { product: "Plexamp", state: "playing" },
  };
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      MediaContainer: {
        Metadata: [
          { ...track, title: "Other user", User: { title: "Someone else" } },
          {
            ...track,
            title: "Other app",
            Player: { product: "Plex Web", state: "playing" },
          },
          {
            ...track,
            title: "Paused",
            Player: { product: "Plexamp", state: "paused" },
          },
          track,
        ],
      },
    })
  );
  vi.stubGlobal("fetch", fetchMock);

  const client = new PlexClient("http://plex:32400", "test-token", "listener");
  await expect(client.getState()).resolves.toMatchObject({
    playState: "playing",
    track: {
      title: track.title,
      artist: track.grandparentTitle,
      album: track.parentTitle,
      positionMs: 42_000,
      source: "plexamp",
    },
  });
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "http://plex:32400/status/sessions"
  );
  expect(fetchMock.mock.calls[0][1].headers["X-Plex-Token"]).toBe("test-token");
});
