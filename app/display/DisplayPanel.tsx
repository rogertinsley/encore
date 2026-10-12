"use client";

import { useEffect, useRef, useState } from "react";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import type { Lyrics } from "@/lib/lrclib/client";
import type { PlayQueue } from "@/lib/eversolo/client";
import { formatTime, trackIdentity } from "@/lib/display/playback";
import styles from "./display.module.css";

export type DisplayPanelTab = "info" | "lyrics" | "queue";
const TABS: DisplayPanelTab[] = ["info", "lyrics", "queue"];

function usePanelData(tab: DisplayPanelTab, data: EnrichedNowPlaying) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [queue, setQueue] = useState<PlayQueue | null>(null);
  const [albumYear, setAlbumYear] = useState<number | null>(null);
  const key = trackIdentity(data);

  useEffect(() => {
    setLyrics(null);
    if (tab !== "lyrics" || !data.artistName || !data.trackName) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      artist: data.artistName,
      title: data.trackName,
    });
    if (data.albumName) params.set("album", data.albumName);
    if (data.durationMs > 0)
      params.set("duration", String(Math.round(data.durationMs / 1000)));
    setLyricsLoading(true);
    fetch(`/api/lyrics?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Lyrics unavailable");
        return response.json() as Promise<Lyrics | null>;
      })
      .then((result) => {
        if (!controller.signal.aborted) setLyrics(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLyrics(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLyricsLoading(false);
      });
    return () => controller.abort();
    // key changes only when the track changes; progress updates do not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, key]);

  useEffect(() => {
    if (tab !== "queue") return;
    const controller = new AbortController();
    const refresh = () => {
      fetch("/api/eversolo/queue", { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Queue unavailable");
          return response.json() as Promise<PlayQueue>;
        })
        .then(setQueue)
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [tab]);

  useEffect(() => {
    setAlbumYear(null);
    if (tab !== "info" || !data.artistName || !data.albumName) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      artist: data.artistName,
      album: data.albumName,
    });
    fetch(`/api/display/album?${params}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<{ year: number | null }>)
      .then((result) => {
        if (!controller.signal.aborted) setAlbumYear(result.year);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, key]);

  return { lyrics, lyricsLoading, queue, albumYear };
}

export function DisplayPanel({
  tab,
  onTabChange,
  onClose,
  data,
  position,
}: {
  tab: DisplayPanelTab;
  onTabChange: (tab: DisplayPanelTab) => void;
  onClose: () => void;
  data: EnrichedNowPlaying;
  position: number;
}) {
  const { lyrics, lyricsLoading, queue, albumYear } = usePanelData(tab, data);
  const start = useRef<{ x: number; y: number } | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activeLine = lyrics?.synced?.reduce(
    (index, line, i) => (line.timeMs <= position ? i : index),
    0
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])"
        )
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeLine, tab]);

  const onTouchEnd = (event: React.TouchEvent) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const dx = event.changedTouches[0].clientX - origin.x;
    const dy = event.changedTouches[0].clientY - origin.y;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const next = TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < TABS.length) onTabChange(TABS[next]);
  };

  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <section
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Now playing details"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          start.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
          event.stopPropagation();
        }}
        onTouchEnd={onTouchEnd}
      >
        <header className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>ENCORE · NOW PLAYING</p>
            <h2>{data.trackName || "Current track"}</h2>
            <p className={styles.panelArtist}>
              {data.artistName || "Unknown artist"}
            </p>
          </div>
          <button
            ref={closeRef}
            className={styles.panelClose}
            type="button"
            aria-label="Close details"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <nav className={styles.panelTabs} aria-label="Display details">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? styles.panelTabActive : ""}
              aria-current={tab === item ? "page" : undefined}
              onClick={() => onTabChange(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className={styles.panelBody}>
          {tab === "info" && (
            <div className={styles.panelContent}>
              <p className={styles.panelSectionLabel}>THE ARTIST</p>
              <h3>{data.artistName || "Unknown artist"}</h3>
              <p className={styles.panelProse}>
                {data.bio ||
                  "Artist biography is not available for this track."}
              </p>
              <div className={styles.panelRule} />
              <p className={styles.panelSectionLabel}>THE RECORD</p>
              <h3>{data.albumName || "Album not provided"}</h3>
              <dl className={styles.albumFacts}>
                <div>
                  <dt>Artist</dt>
                  <dd>{data.artistName || "Unknown"}</dd>
                </div>
                {albumYear && (
                  <div>
                    <dt>First released</dt>
                    <dd>{albumYear}</dd>
                  </div>
                )}
                {data.source && (
                  <div>
                    <dt>Source</dt>
                    <dd>
                      {data.source === "radioparadise"
                        ? "Radio Paradise"
                        : data.source}
                    </dd>
                  </div>
                )}
                {data.audioFormat?.extension && (
                  <div>
                    <dt>Format</dt>
                    <dd>{data.audioFormat.extension}</dd>
                  </div>
                )}
                {data.durationMs > 0 && (
                  <div>
                    <dt>Length</dt>
                    <dd>{formatTime(data.durationMs)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          {tab === "lyrics" &&
            (lyricsLoading ? (
              <p className={styles.panelEmpty}>Finding lyrics…</p>
            ) : lyrics?.synced?.length ? (
              <div className={styles.lyricLines}>
                {lyrics.synced.map((line, i) => (
                  <p
                    key={`${line.timeMs}-${i}`}
                    ref={i === activeLine ? activeLineRef : null}
                    className={i === activeLine ? styles.lyricActive : ""}
                  >
                    {line.text || "\u00a0"}
                  </p>
                ))}
              </div>
            ) : lyrics?.plain ? (
              <pre className={styles.plainLyrics}>{lyrics.plain}</pre>
            ) : (
              <p className={styles.panelEmpty}>
                Lyrics are not available for this track.
              </p>
            ))}
          {tab === "queue" &&
            (queue === null ? (
              <p className={styles.panelEmpty}>Loading queue…</p>
            ) : queue.tracks.length ? (
              <ol className={styles.queueList}>
                {queue.tracks.map((track, i) => (
                  <li
                    key={`${track.id}-${i}`}
                    className={track.active ? styles.queueActive : ""}
                  >
                    <span className={styles.queueNumber}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.queueTitle}>
                      <strong>{track.title || "Unknown track"}</strong>
                      <small>{track.artist || "Unknown artist"}</small>
                    </span>
                    <span className={styles.queueDuration}>
                      {track.durationMs > 0
                        ? formatTime(track.durationMs)
                        : "LIVE"}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.panelEmpty}>The queue is empty.</p>
            ))}
        </div>
        <p className={styles.panelHint}>Swipe left or right to change view</p>
      </section>
    </div>
  );
}
