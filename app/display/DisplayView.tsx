"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useDisplayPreferences } from "@/hooks/useDisplayPreferences";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import {
  formatTime,
  playbackPosition,
  trackIdentity,
} from "@/lib/display/playback";
import type { EnrichedNowPlaying } from "@/lib/enrichment/now-playing";
import {
  sendPlaybackControl,
  type PlaybackAction,
} from "@/lib/eversolo/send-control";
import { DisplaySettings } from "./DisplaySettings";
import styles from "./display.module.css";

function useClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function PlaybackControls({
  state,
}: {
  state: EnrichedNowPlaying["playState"] | "idle";
}) {
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<"playing" | "paused" | null>(
    null
  );
  const [error, setError] = useState("");
  const optimisticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = optimistic ?? state;
  useEffect(() => {
    setOptimistic(null);
    if (optimisticTimer.current) clearTimeout(optimisticTimer.current);
  }, [state]);
  useEffect(
    () => () => {
      if (optimisticTimer.current) clearTimeout(optimisticTimer.current);
    },
    []
  );
  const command = async (action: PlaybackAction) => {
    if (pending) return;
    setPending(true);
    setError("");
    if (action === "playOrPause")
      setOptimistic(shown === "playing" ? "paused" : "playing");
    try {
      await sendPlaybackControl(action);
      optimisticTimer.current = setTimeout(() => setOptimistic(null), 4_000);
    } catch {
      setOptimistic(null);
      setError("Player did not respond");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className={styles.controlArea}>
      <div className={styles.controls}>
        <button
          type="button"
          aria-label="Previous track"
          disabled={pending}
          onClick={() => void command("playLast")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5h2v14H5zm3 7 11 7V5z" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.playButton}
          aria-label={shown === "playing" ? "Pause" : "Play"}
          disabled={pending}
          onClick={() => void command("playOrPause")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            {shown === "playing" ? (
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            ) : (
              <path d="M7 4v16l13-8z" />
            )}
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next track"
          disabled={pending}
          onClick={() => void command("playNext")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 5h-2v14h2zM16 12 5 5v14z" />
          </svg>
        </button>
      </div>
      {error && (
        <p className={styles.controlError} role="status">
          {error}
        </p>
      )}
    </div>
  );
}

function AudioQuality({ data }: { data: EnrichedNowPlaying }) {
  const parts = [
    data.source === "radioparadise" ? "Radio Paradise" : data.source,
    data.audioFormat?.extension,
    data.audioFormat?.bits && data.audioFormat.bits !== "0"
      ? `${data.audioFormat.bits}-bit`
      : null,
    data.audioFormat?.sampleRate,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className={styles.quality} aria-label="Audio quality">
      {parts.map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </div>
  );
}

export function DisplayView() {
  const { data, connection } = useNowPlaying();
  const { preferences, setPreferences } = useDisplayPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [position, setPosition] = useState(0);
  const receivedAt = useRef(Date.now());
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useClock(idle && preferences.clock);
  const key = trackIdentity(data);
  useScreenWakeLock(
    preferences.wakeLock &&
      !!data &&
      data.playState === "playing" &&
      !settingsOpen
  );

  useEffect(() => {
    receivedAt.current = Date.now();
    setPosition(playbackPosition(data, receivedAt.current, receivedAt.current));
  }, [data]);
  useEffect(() => {
    if (data?.playState !== "playing" || connection !== "connected") return;
    const id = window.setInterval(
      () => setPosition(playbackPosition(data, receivedAt.current, Date.now())),
      250
    );
    return () => window.clearInterval(id);
  }, [data, connection]);
  useEffect(() => {
    if (data?.playState === "playing" || key === "__idle__") {
      setIdle(key === "__idle__");
      return;
    }
    setIdle(false);
    const id = window.setTimeout(
      () => setIdle(true),
      preferences.idleTimeout * 1000
    );
    return () => window.clearTimeout(id);
  }, [data?.playState, key, preferences.idleTimeout]);

  const startPress = () => {
    longPress.current = setTimeout(() => setSettingsOpen(true), 700);
  };
  const endPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
  };
  useEffect(
    () => () => {
      if (longPress.current) clearTimeout(longPress.current);
    },
    []
  );
  const duration = data?.durationMs ?? 0;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const disconnected = connection === "disconnected";

  return (
    <div
      className={`${styles.display} ${styles[preferences.layout]} ${preferences.artworkSize === "large" ? styles.largeArt : ""} ${idle && preferences.idleAppearance === "dim" ? styles.dimIdle : ""}`}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
    >
      {data?.albumArtUrl && !idle && (
        <div
          className={`${styles.background} ${preferences.animatedBackground ? styles.animatedBackground : ""}`}
          key={data.albumArtUrl}
        >
          <Image
            src={data.albumArtUrl}
            alt=""
            fill
            sizes="100vw"
            className={styles.backgroundImage}
            unoptimized
          />
        </div>
      )}
      <div className={styles.vignette} />
      <button
        className={styles.settingsButton}
        type="button"
        aria-label="Display settings"
        onClick={() => setSettingsOpen(true)}
      >
        ⋮
      </button>
      {disconnected && (
        <div className={styles.connection} role="status">
          Connection lost · reconnecting
        </div>
      )}
      {connection === "loading" && !data && (
        <div className={styles.initial}>Connecting to Encore…</div>
      )}
      {idle && preferences.idleAppearance === "black" ? (
        <div className={styles.idle} onClick={() => setSettingsOpen(true)}>
          {preferences.clock && (
            <time
              className={styles.idleClock}
              dateTime={new Date(now).toISOString()}
            >
              {new Date(now).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}
          <span className={styles.idleLabel}>
            {disconnected ? "Connection lost" : "Encore"}
          </span>
        </div>
      ) : data ? (
        <div className={styles.stage} key={key}>
          <div className={styles.artworkFrame}>
            {data.albumArtUrl ? (
              <Image
                src={data.albumArtUrl}
                alt={`Cover of ${data.albumName ?? data.trackName}`}
                fill
                priority
                sizes="(orientation: landscape) 48vw, 80vw"
                className={styles.artwork}
              />
            ) : (
              <div className={styles.artworkMissing}>
                <span>♪</span>
              </div>
            )}
          </div>
          <div className={styles.information}>
            <div className={styles.trackText}>
              <p className={styles.eyebrow}>
                <span className={styles.statusDot} />
                {data.playState === "playing" ? "NOW PLAYING" : "PAUSED"}
              </p>
              <h1 title={data.trackName}>
                {data.trackName || "Unknown track"}
              </h1>
              <p className={styles.artist} title={data.artistName}>
                {data.artistName || "Unknown artist"}
              </p>
              <p className={styles.album} title={data.albumName ?? ""}>
                {data.albumName || "Unknown album"}
              </p>
            </div>
            <div className={styles.transport}>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Track progress"
                aria-valuemin={0}
                aria-valuemax={duration || 100}
                aria-valuenow={position}
              >
                <div style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.times}>
                <span>{formatTime(position)}</span>
                <span>{duration > 0 ? formatTime(duration) : "—:——"}</span>
              </div>
              {preferences.controls && (
                <PlaybackControls state={data.playState} />
              )}
              {preferences.quality && <AudioQuality data={data} />}
            </div>
          </div>
        </div>
      ) : (
        !idle && <div className={styles.initial}>Nothing playing</div>
      )}
      {settingsOpen && (
        <DisplaySettings
          value={preferences}
          onChange={setPreferences}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
