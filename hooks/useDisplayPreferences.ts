"use client";

import { useEffect, useState } from "react";

export interface DisplayPreferences {
  layout: "auto" | "landscape" | "portrait";
  artworkSize: "normal" | "large";
  controls: boolean;
  quality: boolean;
  clock: boolean;
  idleTimeout: number;
  wakeLock: boolean;
  animatedBackground: boolean;
  idleAppearance: "black" | "dim";
}

export const defaultPreferences: DisplayPreferences = {
  layout: "auto",
  artworkSize: "normal",
  controls: true,
  quality: true,
  clock: true,
  idleTimeout: 120,
  wakeLock: false,
  animatedBackground: false,
  idleAppearance: "black",
};

const KEY = "encore-display-preferences-v1";

export function parsePreferences(raw: string | null): DisplayPreferences {
  if (!raw) return defaultPreferences;
  try {
    const value = JSON.parse(raw) as Partial<DisplayPreferences>;
    return {
      layout: ["auto", "landscape", "portrait"].includes(value.layout ?? "")
        ? value.layout!
        : "auto",
      artworkSize: ["normal", "large"].includes(value.artworkSize ?? "")
        ? value.artworkSize!
        : "normal",
      controls: typeof value.controls === "boolean" ? value.controls : true,
      quality: typeof value.quality === "boolean" ? value.quality : true,
      clock: typeof value.clock === "boolean" ? value.clock : true,
      idleTimeout: [30, 60, 120, 300].includes(value.idleTimeout ?? -1)
        ? value.idleTimeout!
        : 120,
      wakeLock: typeof value.wakeLock === "boolean" ? value.wakeLock : false,
      animatedBackground:
        typeof value.animatedBackground === "boolean"
          ? value.animatedBackground
          : false,
      idleAppearance: ["black", "dim"].includes(value.idleAppearance ?? "")
        ? value.idleAppearance!
        : "black",
    };
  } catch {
    return defaultPreferences;
  }
}

export function useDisplayPreferences() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPreferences(parsePreferences(localStorage.getItem(KEY)));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(preferences));
  }, [preferences, ready]);
  return { preferences, setPreferences };
}
