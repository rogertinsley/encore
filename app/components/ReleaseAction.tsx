"use client";

import { useEffect, useState } from "react";
import type { ReleaseProgress } from "@/lib/lidarr/progress";

const labels: Record<ReleaseProgress, string> = {
  "not-tracked": "Not in Lidarr",
  unmonitored: "Unmonitored",
  monitored: "Monitored",
  partial: "Partly imported",
  downloaded: "Imported",
  queued: "Queued",
  downloading: "Downloading",
  "import-failed": "Import failed",
};

export function ReleaseAction({
  mbid,
  path,
  status: initialStatus,
  releaseDate,
}: {
  mbid: string | null;
  path: string | null;
  status: ReleaseProgress | null;
  releaseDate?: string | null;
}) {
  const [updatedStatus, setUpdatedStatus] = useState<ReleaseProgress | null>(
    null
  );
  const status = updatedStatus ?? initialStatus;
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ message: string; ok: boolean } | null>(
    null
  );
  const upcoming = Boolean(releaseDate && Date.parse(releaseDate) > Date.now());
  const busy = status === "queued" || status === "downloading";
  const complete =
    status === "downloaded" || (upcoming && status === "monitored");

  const polling = busy || (result?.ok === true && !complete);
  useEffect(() => {
    if (!polling || !mbid) return;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/releases/${encodeURIComponent(mbid)}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          status: ReleaseProgress | null;
        };
        if (data.status) {
          setUpdatedStatus(data.status);
          setResult(null);
        }
      } catch {
        // Keep the last known status until Lidarr is reachable.
      }
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [mbid, polling]);

  async function submit() {
    if (!path || pending || result?.ok || busy || complete) return;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const data = (await response.json()) as { message: string };
      setResult({ message: data.message, ok: response.ok });
    } catch {
      setResult({ message: "Could not reach Lidarr. Try again.", ok: false });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      {status && (
        <span
          className={`text-sm ${status === "import-failed" ? "text-red-300" : "text-warm-300"}`}
        >
          {labels[status]}
        </span>
      )}
      {path && !complete && !busy && (
        <button
          type="button"
          aria-disabled={pending || result?.ok || undefined}
          onClick={submit}
          className="min-h-9 text-left text-sm text-amber-accent underline-offset-4 hover:underline aria-disabled:opacity-70"
        >
          {pending
            ? "Sending…"
            : upcoming
              ? "Monitor release"
              : "Search in Lidarr"}
        </button>
      )}
      <span
        role="status"
        className={`text-sm ${result?.ok ? "text-emerald-300" : "text-red-300"}`}
      >
        {result?.message}
      </span>
    </div>
  );
}
