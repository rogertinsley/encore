"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import type { Lyrics, LyricLine } from "@/lib/lrclib/client";
import type { PlayQueue } from "@/lib/eversolo/client";

const CROSSFADE_MS = 800;

// ── Colour extraction ────────────────────────────────────────────────────────

interface AlbumColors {
  primary: string;
  secondary: string;
}

function useAlbumColors(imageUrl: string | null): AlbumColors | null {
  const [colors, setColors] = useState<AlbumColors | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColors(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 50, 50);
        const { data } = ctx.getImageData(0, 0, 50, 50);

        const buckets = new Map<
          string,
          { r: number; g: number; b: number; count: number }
        >();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // skip near-black and near-grey pixels — they're uninteresting
          if (Math.max(r, g, b) < 30) continue;
          if (Math.max(r, g, b) - Math.min(r, g, b) < 25) continue;
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;
          const ex = buckets.get(key);
          if (ex) ex.count++;
          else buckets.set(key, { r: qr, g: qg, b: qb, count: 1 });
        }

        const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
        if (sorted.length === 0) return;
        const p = sorted[0];
        const s = sorted[1] ?? sorted[0];
        setColors({
          primary: `rgb(${p.r},${p.g},${p.b})`,
          secondary: `rgb(${s.r},${s.g},${s.b})`,
        });
      } catch {
        setColors(null);
      }
    };

    img.onerror = () => setColors(null);
    img.src = imageUrl;
  }, [imageUrl]);

  return colors;
}

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

async function sendControl(action: string) {
  await fetch("/api/eversolo/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

function PlayerControls({
  playState,
}: {
  playState: "playing" | "paused" | "idle";
}) {
  const [busy, setBusy] = useState(false);
  // Optimistic: flip immediately on click, SSE corrects within ~300ms
  const [optimisticState, setOptimisticState] = useState<
    "playing" | "paused" | "idle" | null
  >(null);
  const displayState = optimisticState ?? playState;

  // Clear optimistic state once SSE confirms the real state
  useEffect(() => {
    setOptimisticState(null);
  }, [playState]);

  const control = async (action: string) => {
    if (busy) return;
    setBusy(true);
    if (action === "playOrPause") {
      setOptimisticState(displayState === "playing" ? "paused" : "playing");
    }
    try {
      await sendControl(action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5 shrink-0">
      <button
        onClick={() => control("playLast")}
        disabled={busy}
        className="text-white/70 hover:text-white transition-colors disabled:opacity-40"
        aria-label="Previous"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      <button
        onClick={() => control("playOrPause")}
        disabled={busy}
        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-40 shrink-0"
        aria-label={displayState === "playing" ? "Pause" : "Play"}
      >
        {displayState === "playing" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button
        onClick={() => control("playNext")}
        disabled={busy}
        className="text-white/70 hover:text-white transition-colors disabled:opacity-40"
        aria-label="Next"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.93V8.07L8.5 12zM16 6h2v12h-2z" />
        </svg>
      </button>
    </div>
  );
}

function AudioQualityBadge({
  format,
  source,
}: {
  format: EnrichedNowPlaying["audioFormat"];
  source: EnrichedNowPlaying["source"];
}) {
  const qualityParts = format
    ? [
        format.extension?.toUpperCase() || null,
        format.bits && format.bits !== "0" ? `${format.bits}-bit` : null,
        format.sampleRate || null,
      ].filter(Boolean)
    : [];

  if (!source && qualityParts.length === 0) return null;

  return (
    <p className="font-mono text-xs text-white/35 tabular-nums shrink-0 flex items-center gap-1.5">
      {source === "qobuz" && (
        <span className="text-white/55 font-sans font-medium tracking-wide">
          Qobuz
        </span>
      )}
      {qualityParts.length > 0 && <span>{qualityParts.join(" · ")}</span>}
    </p>
  );
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

function currentLineIndex(lines: LyricLine[], positionMs: number): number {
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i;
    else break;
  }
  return idx;
}

function LyricsPanel({
  lyrics,
  positionMs,
  playing,
}: {
  lyrics: Lyrics;
  positionMs: number;
  playing: boolean;
}) {
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = lyrics.synced;
  const activeIdx = lines ? currentLineIndex(lines, positionMs) : -1;

  // Auto-scroll to active line
  useEffect(() => {
    if (!lines || activeIdx < 0) return;
    const el = lineRefs.current[activeIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx, lines]);

  if (!lines) {
    // Plain lyrics fallback
    if (!lyrics.plain) return null;
    return (
      <div
        ref={containerRef}
        className="absolute top-16 right-0 bottom-20 hidden md:block w-5/12 overflow-y-auto px-8 py-6"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
        }}
      >
        <pre className="text-sm text-white/50 whitespace-pre-wrap leading-7 font-sans">
          {lyrics.plain}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-16 right-0 bottom-20 hidden md:block w-5/12 overflow-y-auto px-8 py-6"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
      }}
    >
      <div className="flex flex-col gap-3">
        {lines.map((line, i) => {
          const isActive = i === activeIdx;
          const isNear = Math.abs(i - activeIdx) <= 2;
          return (
            <p
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className="leading-snug transition-all duration-300"
              style={{
                fontSize: isActive ? "1.35rem" : isNear ? "1rem" : "0.9rem",
                fontWeight: isActive ? 700 : 400,
                color: isActive
                  ? "rgba(255,255,255,1)"
                  : isNear
                    ? "rgba(255,255,255,0.45)"
                    : "rgba(255,255,255,0.2)",
                opacity: playing || !isActive ? 1 : 0.7,
              }}
            >
              {line.text || "\u00A0"}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function QueuePanel({ queue }: { queue: PlayQueue }) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [queue]);

  if (queue.tracks.length === 0) {
    return (
      <div className="absolute top-16 right-0 bottom-20 hidden md:flex w-5/12 items-center justify-center">
        <p className="text-white/25 text-sm tracking-wide">Queue is empty</p>
      </div>
    );
  }

  return (
    <div
      className="absolute top-16 right-0 bottom-20 hidden md:block w-5/12 overflow-y-auto px-6 py-4"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
      }}
    >
      <div className="flex flex-col gap-1">
        {queue.tracks.map((track, i) => (
          <div
            key={`${track.id}-${i}`}
            ref={track.active ? activeRef : null}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              track.active ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm truncate leading-tight ${
                  track.active ? "text-white font-medium" : "text-white/65"
                }`}
              >
                {track.title}
              </p>
              <p className="text-xs text-white/35 truncate">{track.artist}</p>
            </div>
            <p className="font-mono text-xs text-white/30 tabular-nums shrink-0">
              {formatDuration(track.durationMs)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

type RightPanelTab = "queue" | "lyrics";

function RightPanel({
  lyrics,
  queue,
  positionMs,
  playing,
}: {
  lyrics: Lyrics | null;
  queue: PlayQueue | null;
  positionMs: number;
  playing: boolean;
}) {
  const hasLyrics = !!lyrics;
  const hasQueue = !!queue && queue.tracks.length > 0;
  const [tab, setTab] = useState<RightPanelTab>("queue");

  // Default to lyrics tab when lyrics first arrive and queue is empty
  useEffect(() => {
    if (hasLyrics && !hasQueue) setTab("lyrics");
    if (hasQueue && !hasLyrics) setTab("queue");
  }, [hasLyrics, hasQueue]);

  if (!hasLyrics && !hasQueue) return null;

  return (
    <>
      {/* Tab toggle — only shown when both are available */}
      {hasLyrics && hasQueue && (
        <div className="absolute top-4 right-6 flex gap-1 z-10">
          {(["queue", "lyrics"] as RightPanelTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1 rounded-full transition-colors capitalize ${
                tab === t
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {tab === "lyrics" && hasLyrics && (
        <LyricsPanel
          lyrics={lyrics!}
          positionMs={positionMs}
          playing={playing}
        />
      )}
      {tab === "queue" && hasQueue && <QueuePanel queue={queue!} />}
    </>
  );
}

function NowPlayingCard({
  data,
  lyrics,
  queue,
}: {
  data: EnrichedNowPlaying | null;
  lyrics: Lyrics | null;
  queue: PlayQueue | null;
}) {
  const [displayMs, setDisplayMs] = useState(data?.positionMs ?? 0);
  const receivedAtRef = useRef(Date.now());
  const albumColors = useAlbumColors(data?.albumArtUrl ?? null);
  const waveColor = albumColors?.primary ?? "#c8965a";

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
    }, 250);
    return () => clearInterval(id);
  }, [data?.positionMs, data?.playState]);

  if (!data) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-warm-950">
        <div className="w-16 h-16 rounded-full bg-warm-800 flex items-center justify-center">
          <span className="text-2xl text-warm-500">♪</span>
        </div>
        <p className="text-warm-500 text-sm tracking-wide">Nothing playing</p>
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
          {/* Subtle colour tint derived from album art */}
          {albumColors && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${albumColors.primary}30 0%, transparent 55%),
                             radial-gradient(ellipse at 75% 60%, ${albumColors.secondary}25 0%, transparent 50%)`,
              }}
            />
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-warm-950" />
      )}

      {/* Right panel — queue or lyrics */}
      <RightPanel
        lyrics={lyrics}
        queue={queue}
        positionMs={displayMs}
        playing={playing}
      />

      {/* Bottom info block — sits above the progress bar */}
      <div className="absolute bottom-1 left-0 right-0 px-4 md:px-8 pb-6">
        {/* Row 1: album art + track info + controls */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Album art thumbnail */}
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-md overflow-hidden shrink-0 bg-warm-800 shadow-xl shadow-black/40">
            {data.albumArtUrl ? (
              <Image
                src={data.albumArtUrl}
                alt={data.albumName ?? data.trackName}
                width={96}
                height={96}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xl text-warm-600">♪</span>
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-xl font-semibold text-white truncate leading-tight tracking-tight">
              {data.trackName}
            </h1>
            <Link
              href={`/artist/${encodeURIComponent(data.artistName)}`}
              className="text-sm text-white/70 hover:text-white transition-colors truncate block mt-0.5"
            >
              {data.artistName}
            </Link>
            {data.albumName && (
              <p className="text-xs text-white/40 truncate mt-0.5 font-mono">
                {data.albumName}
              </p>
            )}
          </div>

          {/* Playback controls */}
          <PlayerControls playState={data.playState} />
        </div>

        {/* Row 2: eq + status + time + quality (hidden on very small screens or collapsed) */}
        <div className="flex items-center gap-3 mt-2 pl-0">
          <div className="flex items-center gap-2">
            <EqualizerBars playing={playing} />
            <span className="text-xs text-emerald-400/90 font-mono tracking-wide whitespace-nowrap">
              {playing ? "playing" : "paused"}
            </span>
          </div>
          {data.durationMs > 0 && (
            <p className="font-mono text-xs text-white/40 tabular-nums whitespace-nowrap">
              {formatTime(displayMs)} / {formatTime(data.durationMs)}
            </p>
          )}
          <AudioQualityBadge format={data.audioFormat} source={data.source} />
        </div>
      </div>

      {/* Full-width progress bar pinned to bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            transition: "width 1s linear",
            backgroundColor: waveColor,
          }}
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
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [queue, setQueue] = useState<PlayQueue | null>(null);

  const shownIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch and refresh queue every 5s
  useEffect(() => {
    const fetchQueue = () => {
      fetch("/api/eversolo/queue")
        .then((r) => r.json())
        .then((data: PlayQueue) => setQueue(data))
        .catch(() => null);
    };
    fetchQueue();
    const id = setInterval(fetchQueue, 5_000);
    return () => clearInterval(id);
  }, []);

  // Fetch lyrics whenever the track changes
  useEffect(() => {
    if (!displayed) {
      setLyrics(null);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      artist: displayed.artistName,
      title: displayed.trackName,
    });
    if (displayed.albumName) params.set("album", displayed.albumName);
    if (displayed.durationMs > 0)
      params.set("duration", String(Math.round(displayed.durationMs / 1000)));

    fetch(`/api/lyrics?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Lyrics | null) => setLyrics(data))
      .catch(() => {});

    return () => controller.abort();
  }, [trackId(displayed)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!displayed) {
      document.title = "Encore";
    } else {
      document.title = `${displayed.artistName} · ${displayed.trackName} | Encore`;
    }
    return () => {
      document.title = "Encore";
    };
  }, [displayed]);

  useEffect(() => {
    const es = new EventSource("/api/now-playing/stream");

    es.onmessage = (event: MessageEvent<string>) => {
      const json: EnrichedNowPlaying | null = JSON.parse(event.data);
      setLatest(json);
      setLoading(false);
    };

    return () => {
      es.close();
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
      <div className="fixed inset-0 z-10 flex items-center justify-center bg-warm-950">
        <p className="text-warm-500 text-sm animate-pulse tracking-wide">
          Loading…
        </p>
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
        <NowPlayingCard data={latest} lyrics={null} queue={null} />
      </div>

      {/* Displayed layer (front) — fades out */}
      <div
        style={{
          gridArea: "1/1",
          opacity: fading ? 0 : 1,
          transition: transitionStyle,
        }}
      >
        <NowPlayingCard data={displayed} lyrics={lyrics} queue={queue} />
      </div>
    </div>
  );
}
