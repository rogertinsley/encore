import { describe, expect, it, vi, beforeEach } from "vitest";

const { control, triggerPoll } = vi.hoisted(() => ({
  control: vi.fn(),
  triggerPoll: vi.fn(),
}));
vi.mock("@/lib/clients", () => ({ clients: { eversolo: { control } } }));
vi.mock("@/lib/poller/pipeline", () => ({
  nowPlayingPipeline: { triggerPoll },
}));
import { POST } from "./route";

const request = (action: string, origin = "https://encore.rogertinsley.com") =>
  new Request("https://encore.rogertinsley.com/api/eversolo/control", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });

beforeEach(() => {
  control.mockReset();
  triggerPoll.mockReset();
});

describe("playback commands", () => {
  it("sends valid same-origin actions and refreshes state", async () => {
    control.mockResolvedValue(undefined);
    const response = await POST(request("playNext"));
    expect(response.status).toBe(200);
    expect(control).toHaveBeenCalledWith("playNext");
    expect(triggerPoll).toHaveBeenCalledOnce();
  });
  it("rejects cross-origin and invalid actions", async () => {
    expect(
      (await POST(request("playNext", "https://other.example"))).status
    ).toBe(403);
    expect((await POST(request("delete"))).status).toBe(400);
    expect(control).not.toHaveBeenCalled();
  });
  it("reports Eversolo failure without claiming success", async () => {
    control.mockRejectedValue(new Error("offline"));
    expect((await POST(request("playOrPause"))).status).toBe(503);
    expect(triggerPoll).not.toHaveBeenCalled();
  });
});
