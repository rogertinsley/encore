"use client";

import { useState } from "react";

export function AddArtistButton({ artistName }: { artistName: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  async function addArtist() {
    if (pending || result?.ok) return;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(
        `/api/artist/${encodeURIComponent(artistName)}/lidarr`,
        { method: "POST" }
      );
      const { message } = (await response.json()) as { message: string };
      setResult({ ok: response.ok, message });
    } catch {
      setResult({ ok: false, message: "Could not reach Lidarr. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        aria-disabled={pending || result?.ok || undefined}
        onClick={addArtist}
        className="min-h-11 rounded border border-amber-accent px-4 text-sm font-medium text-amber-light hover:bg-amber-accent/10 aria-disabled:opacity-75"
      >
        {pending ? "Adding…" : result?.ok ? "In Lidarr" : "Add to Lidarr"}
      </button>
      <span
        role="status"
        className={`text-sm ${result?.ok ? "text-emerald-300" : "text-red-300"}`}
      >
        {result?.message}
      </span>
    </div>
  );
}
