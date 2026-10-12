"use client";

import type { DisplayPreferences } from "@/hooks/useDisplayPreferences";
import styles from "./display.module.css";

type Props = {
  value: DisplayPreferences;
  onChange: (value: DisplayPreferences) => void;
  onClose: () => void;
};

export function DisplaySettings({ value, onChange, onClose }: Props) {
  const update = <K extends keyof DisplayPreferences>(
    key: K,
    next: DisplayPreferences[K]
  ) => onChange({ ...value, [key]: next });
  return (
    <div className={styles.settingsBackdrop} onClick={onClose}>
      <section
        className={styles.settings}
        role="dialog"
        aria-modal="true"
        aria-label="Display settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.settingsHeading}>
          <div>
            <span className={styles.eyebrow}>ENCORE / DISPLAY</span>
            <h2>Display settings</h2>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        <div className={styles.settingsFields}>
          <label>
            Layout{" "}
            <select
              value={value.layout}
              onChange={(e) =>
                update("layout", e.target.value as DisplayPreferences["layout"])
              }
            >
              <option value="auto">Auto</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
          <label>
            Artwork size{" "}
            <select
              value={value.artworkSize}
              onChange={(e) =>
                update(
                  "artworkSize",
                  e.target.value as DisplayPreferences["artworkSize"]
                )
              }
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Idle after{" "}
            <select
              value={value.idleTimeout}
              onChange={(e) => update("idleTimeout", Number(e.target.value))}
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </label>
          <label>
            Idle appearance{" "}
            <select
              value={value.idleAppearance}
              onChange={(e) =>
                update(
                  "idleAppearance",
                  e.target.value as DisplayPreferences["idleAppearance"]
                )
              }
            >
              <option value="black">Mostly black</option>
              <option value="dim">Dim track</option>
            </select>
          </label>
          {(
            [
              ["controls", "Playback controls"],
              ["quality", "Audio quality"],
              ["clock", "Clock while idle"],
              ["wakeLock", "Keep screen awake while playing"],
              ["animatedBackground", "Animated background"],
            ] as const
          ).map(([key, label]) => (
            <label className={styles.toggle} key={key}>
              {label}
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
        <p className={styles.settingsNote}>
          Screen brightness and sleep are controlled in Android settings.
        </p>
      </section>
    </div>
  );
}
