"use client";

import { useEffect } from "react";
import { createScreenWakeLockController } from "@/lib/display/screen-wake-lock";

export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    const controller = createScreenWakeLockController(
      navigator.wakeLock,
      () => document.visibilityState === "visible"
    );
    const onVisibility = () => {
      if (document.visibilityState === "visible") void controller.acquire();
      else controller.release();
    };
    void controller.acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.dispose();
    };
  }, [enabled]);
}
