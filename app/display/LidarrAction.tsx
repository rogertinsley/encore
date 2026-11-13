"use client";

import { useState } from "react";
import styles from "./display.module.css";

export function LidarrAction({
  trackKey,
  disconnected,
  lidarrUrl,
  configured,
}: {
  trackKey: string;
  disconnected: boolean;
  lidarrUrl: string;
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function addArtist() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/display/lidarr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedTrackIdentity: trackKey }),
      });
      const result = await response.json();
      setMessage(result.message);
    } catch {
      setMessage("Lidarr request failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className={styles.detailActions}>
        {configured && (
          <button
            type="button"
            disabled={pending || disconnected}
            onClick={addArtist}
          >
            {pending ? "Sending to Lidarr…" : "Add artist & search albums"}
          </button>
        )}
        <a href={lidarrUrl} target="_blank" rel="noreferrer">
          Open Lidarr
        </a>
      </div>
      {message && (
        <span className={styles.controlError} role="status">
          {message}
        </span>
      )}
    </>
  );
}
