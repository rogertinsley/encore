export function createScreenWakeLockController(
  wakeLock: Pick<WakeLock, "request">,
  isVisible: () => boolean
) {
  let sentinel: WakeLockSentinel | null = null;
  let acquiring = false;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const release = () => {
    clearRetry();
    const current = sentinel;
    sentinel = null;
    current?.removeEventListener("release", onRelease);
    void current?.release().catch(() => {});
  };

  const onRelease = () => {
    const current = sentinel;
    sentinel = null;
    current?.removeEventListener("release", onRelease);
    if (!disposed && isVisible()) {
      clearRetry();
      retryTimer = setTimeout(() => void acquire(), 1_000);
    }
  };

  const acquire = async () => {
    if (disposed || !isVisible() || sentinel || acquiring) return;
    acquiring = true;
    try {
      const acquired = await wakeLock.request("screen");
      if (disposed || !isVisible()) {
        await acquired.release();
        return;
      }
      sentinel = acquired;
      acquired.addEventListener("release", onRelease);
    } catch {
      // Permission, battery and platform restrictions are expected.
    } finally {
      acquiring = false;
    }
  };

  return {
    acquire,
    release,
    dispose() {
      disposed = true;
      release();
    },
  };
}
