import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPlaybackControl } from "./send-control";

afterEach(() => vi.restoreAllMocks());

describe("sendPlaybackControl", () => {
  it("sends the selected action", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true } as Response);

    await sendPlaybackControl("playNext");

    expect(fetchMock).toHaveBeenCalledWith("/api/eversolo/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "playNext" }),
    });
  });

  it("rejects failed HTTP responses and network errors", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(sendPlaybackControl("playOrPause")).rejects.toThrow("503");
    await expect(sendPlaybackControl("playNext")).rejects.toThrow(
      "network down"
    );
  });
});
