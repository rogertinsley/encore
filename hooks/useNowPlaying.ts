"use client";

import { useEffect, useState } from "react";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

export function useNowPlaying() {
  const [data, setData] = useState<EnrichedNowPlaying | null>(null);
  const [connection, setConnection] = useState<
    "loading" | "connected" | "disconnected"
  >("loading");

  useEffect(() => {
    let source: EventSource | null = null;
    const connect = () => {
      source?.close();
      source = new EventSource("/api/now-playing/stream");
      source.onerror = () => setConnection("disconnected");
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          setData(JSON.parse(event.data) as EnrichedNowPlaying | null);
          setConnection("connected");
        } catch {
          setConnection("disconnected");
        }
      };
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setConnection("loading");
        connect();
      } else {
        source?.close();
        source = null;
      }
    };
    if (document.visibilityState === "visible") connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      source?.close();
    };
  }, []);

  return { data, connection };
}
