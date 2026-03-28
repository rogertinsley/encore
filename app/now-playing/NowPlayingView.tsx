"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";

const POLL_INTERVAL_MS = 3_000;
const CROSSFADE_MS = 800;

function trackId(data: EnrichedNowPlaying | null): string {
  if (!data) return "__empty__";
  return `${data.artistName}::${data.trackName}`;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function EqualizerBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: "#34d399",
            animation: playing
              ? `eq-bounce ${0.6 + i * 0.15}s ease-in-out infinite alternate`
              : "none",
            height: playing ? undefined : 4,
            minHeight: 4,
          }}
        />
      ))}
      <style>{`
        @keyframes eq-bounce {
          from { height: 4px; }
          to   { height: 16px; }
        }
      `}</style>
    </div>
  );
}

function NowPlayingCard({ data }: { data: EnrichedNowPlaying | null }) {
  const [displayMs, setDisplayMs] = useState(data?.positionMs ?? 0);
  const receivedAtRef = useRef(Date.now());

  useEffect(() => {
    receivedAtRef.current = Date.now();
    setDisplayMs(data?.positionMs ?? 0);
  }, [data?.positionMs]);

  useEffect(() => {
    if (!data || data.playState !== "playing") return;
    const startPos = data.positionMs;
    const startedAt = receivedAtRef.current;
    const id = setInterval(() => {
      setDisplayMs(startPos + (Date.now() - startedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [data?.positionMs, data?.playState]);

  if (!data) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-2xl">♪</span>
        </div>
        <p className="text-zinc-500 text-sm">Nothing playing</p>
      </div>
    );
  }

  const playing = data.playState === "playing";
  const pct =
    data.durationMs > 0
      ? Math.min((displayMs / data.durationMs) * 100, 100)
      : 0;

  return (
    <div className="absolute inset-0">
      {/* Full-viewport background */}
      {data.artistImages?.background ? (
        <>
          <Image
            src={data.artistImages.background}
            alt={data.artistName}
            fill
            className="object-cover object-top"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.92) 100%)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-zinc-950" />
      )}

      {/* Bottom info block — sits above the progress bar */}
      <div className="absolute bottom-1 left-0 right-0 px-8 pb-6">
        <div className="flex items-center gap-5">
          {/* Album art thumbnail */}
          <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-zinc-800 shadow-xl">
            {data.albumArtUrl ? (
              <Image
                src={data.albumArtUrl}
                alt={data.albumName ?? data.trackName}
                width={56}
                height={56}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xl text-zinc-600">♪</span>
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate leading-tight">
              {data.trackName}
            </h1>
            <Link
              href={`/artist/${encodeURIComponent(data.artistName)}`}
              className="text-sm text-zinc-300 hover:text-white transition-colors truncate block"
            >
              {data.artistName}
            </Link>
            {data.albumName && (
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {data.albumName}
              </p>
            )}
          </div>

          {/* Equalizer + status */}
          <div className="flex items-center gap-2 shrink-0">
            <EqualizerBars playing={playing} />
            <span className="text-xs text-emerald-400 font-medium">
              {playing ? "Now Playing" : "Paused"}
            </span>
          </div>

          {/* Time */}
          {data.durationMs > 0 && (
            <p className="text-xs text-zinc-500 tabular-nums shrink-0">
              {formatTime(displayMs)} / {formatTime(data.durationMs)}
            </p>
          )}
        </div>
      </div>

      {/* Full-width progress bar pinned to bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-400"
          style={{ width: `${pct}%`, transition: "width 1s linear" }}
        />
      </div>
    </div>
  );
}

export function NowPlayingView() {
  const [latest, setLatest] = useState<EnrichedNowPlaying | null>(null);
  const [displayed, setDisplayed] = useState<EnrichedNowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);

  const shownIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchTrack = async () => {
      try {
        const res = await fetch("/api/now-playing");
        const json: EnrichedNowPlaying | null = await res.json();
        setLatest(json);
        setLoading(false);
      } catch {
        // keep previous state on error
      }
    };

    void fetchTrack();
    const interval = setInterval(fetchTrack, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const incoming = trackId(latest);

    if (shownIdRef.current === null) {
      shownIdRef.current = incoming;
      setDisplayed(latest);
      return;
    }

    if (shownIdRef.current === incoming) {
      setDisplayed(latest);
      return;
    }

    shownIdRef.current = incoming;
    setFading(true);
    timerRef.current = setTimeout(() => {
      setDisplayed(latest);
      setFading(false);
    }, CROSSFADE_MS);
  }, [latest, loading]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center bg-zinc-950">
        <p className="text-zinc-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  const transitionStyle = `opacity ${CROSSFADE_MS}ms ease-in-out`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10, display: "grid" }}>
      {/* Incoming layer (behind) — fades in */}
      <div
        style={{
          gridArea: "1/1",
          opacity: fading ? 1 : 0,
          transition: transitionStyle,
          pointerEvents: "none",
        }}
      >
        <NowPlayingCard data={latest} />
      </div>

      {/* Displayed layer (front) — fades out */}
      <div
        style={{
          gridArea: "1/1",
          opacity: fading ? 0 : 1,
          transition: transitionStyle,
        }}
      >
        <NowPlayingCard data={displayed} />
      </div>
    </div>
  );
}
