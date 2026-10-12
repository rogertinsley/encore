import { afterEach, describe, expect, it, vi } from "vitest";
import { createScreenWakeLockController } from "./screen-wake-lock";

function makeSentinel() {
  const target = new EventTarget();
  const release = vi.fn(async () => {
    target.dispatchEvent(new Event("release"));
  });
  return Object.assign(target, { release }) as unknown as WakeLockSentinel;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("screen wake lock", () => {
  it("does not issue duplicate requests while acquisition is pending", async () => {
    const sentinel = makeSentinel();
    let resolveRequest!: (value: WakeLockSentinel) => void;
    const request = vi.fn(
      () =>
        new Promise<WakeLockSentinel>((resolve) => {
          resolveRequest = resolve;
        })
    );
    const controller = createScreenWakeLockController(
      { request } as unknown as Pick<WakeLock, "request">,
      () => true
    );

    const first = controller.acquire();
    const second = controller.acquire();
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest(sentinel);
    await Promise.all([first, second]);
    controller.dispose();
    expect(sentinel.release).toHaveBeenCalledOnce();
  });

  it("reacquires after the browser releases a visible lock", async () => {
    vi.useFakeTimers();
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const controller = createScreenWakeLockController(
      { request } as unknown as Pick<WakeLock, "request">,
      () => true
    );

    await controller.acquire();
    first.dispatchEvent(new Event("release"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(request).toHaveBeenCalledTimes(2);
    controller.dispose();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it("tolerates unsupported or denied wake lock requests", async () => {
    const request = vi.fn().mockRejectedValue(new Error("denied"));
    const controller = createScreenWakeLockController(
      { request } as unknown as Pick<WakeLock, "request">,
      () => true
    );
    await expect(controller.acquire()).resolves.toBeUndefined();
    controller.dispose();
  });
});
