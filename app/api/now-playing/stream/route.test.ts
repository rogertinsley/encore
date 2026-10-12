import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn() } }));

import { redis } from "@/lib/redis";
import { GET } from "./route";

const get = vi.mocked(redis.get);

afterEach(() => {
  vi.clearAllMocks();
});

describe("now-playing SSE", () => {
  it("publishes current Redis state", async () => {
    get.mockResolvedValue(null);
    const response = await GET();
    const reader = response.body!.getReader();

    const message = await reader.read();
    expect(new TextDecoder().decode(message.value)).toBe("data: null\n\n");
    await reader.cancel();
  });

  it("ends the stream on Redis failure so EventSource can reconnect", async () => {
    get.mockRejectedValue(new Error("Redis unavailable"));
    const response = await GET();
    const reader = response.body!.getReader();

    await expect(reader.read()).rejects.toThrow("Redis unavailable");
  });
});
