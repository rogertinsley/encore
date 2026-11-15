import { expect, it, vi } from "vitest";
import { redis } from "@/lib/redis";
import { invalidateRedisSnapshot, readRedisSnapshot } from "./redis-snapshot";

vi.mock("@/lib/redis", async () => ({
  redis: (await import("./redis-snapshot.test-fixture")).createTestRedis(),
}));

const timing = { freshFor: 10, retainFor: 100 };
const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it("shares a cold refresh and serves fresh Redis reads", async () => {
  const load = vi.fn(async () => "loaded");
  expect(
    await Promise.all([
      readRedisSnapshot("cold", timing, load),
      readRedisSnapshot("cold", timing, load),
    ])
  ).toEqual(["loaded", "loaded"]);
  expect(await readRedisSnapshot("cold", timing, load)).toBe("loaded");
  expect(load).toHaveBeenCalledOnce();
});

it("serves stale data while refreshing and retains it on upstream failure", async () => {
  await redis.setex(
    "stale",
    100,
    JSON.stringify({ value: "last good", freshUntil: 0 })
  );
  const load = vi.fn().mockRejectedValue(new Error("upstream offline"));
  expect(await readRedisSnapshot("stale", timing, load)).toBe("last good");
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  expect(JSON.parse((await redis.get("stale"))!).value).toBe("last good");
});

it("prevents an in-flight refresh from restoring invalidated membership", async () => {
  const old = deferred();
  const load = vi.fn(() => old.promise);
  const first = readRedisSnapshot("invalidated", timing, load);
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  await invalidateRedisSnapshot("invalidated");
  await expect(
    readRedisSnapshot("invalidated", timing, async () => "updated")
  ).resolves.toBe("updated");
  old.resolve("before the mutation");
  await first;
  expect(await readRedisSnapshot("invalidated", timing, load)).toBe("updated");
});
