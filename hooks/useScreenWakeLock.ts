"use client";

import { useEffect } from "react";

export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible" || sentinel)
        return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (disposed) void acquired.release();
        else sentinel = acquired;
      } catch {
        // Permission, battery and platform restrictions are expected.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else {
        void sentinel?.release();
        sentinel = null;
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [enabled]);
}
