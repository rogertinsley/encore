"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

const POLL_INTERVAL_MS = 30_000;

export function NowPlayingView() {
  const [data, setData] = useState<EnrichedNowPlaying | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrack = async () => {
      try {
        const res = await fetch("/api/now-playing");
        const json: EnrichedNowPlaying | null = await res.json();
        setData(json);
      } catch {
        // keep previous state on error
      } finally {
        setLoading(false);
      }
    };

    void fetchTrack();
    const interval = setInterval(fetchTrack, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-2xl">♪</span>
        </div>
        <p className="text-zinc-500 text-sm">Nothing playing</p>
      </div>
    );
  }

  return (
    <div className="relative -mx-6 -mt-8">
      {/* Full-bleed background */}
      {data.artistImages?.background ? (
        <div className="absolute inset-0 overflow-hidden rounded-b-lg">
          <Image
            src={data.artistImages.background}
            alt={data.artistName}
            fill
            className="object-cover object-top"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/90" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-b-lg" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 py-16">
        {/* Album art */}
        <div className="w-48 h-48 rounded-lg overflow-hidden shadow-2xl shrink-0 bg-zinc-800">
          {data.albumArtUrl ? (
            <Image
              src={data.albumArtUrl}
              alt={data.albumName ?? data.trackName}
              width={192}
              height={192}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl text-zinc-600">♪</span>
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex flex-col items-center gap-1 max-w-xl text-center">
          <h1 className="text-3xl font-bold text-white leading-tight">
            {data.trackName}
          </h1>
          <p className="text-xl text-zinc-300">{data.artistName}</p>
          {data.albumName && (
            <p className="text-sm text-zinc-500 mt-1">{data.albumName}</p>
          )}
        </div>

        {/* Live badge */}
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Now Playing
        </span>

        {/* Bio */}
        {data.bio && (
          <p className="max-w-lg text-sm text-zinc-400 text-center leading-relaxed border-t border-zinc-700/50 pt-6">
            {data.bio}
          </p>
        )}
      </div>
    </div>
  );
}
