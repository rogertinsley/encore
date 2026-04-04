"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { timeAgo } from "@/lib/utils/time";

interface RecentTrack {
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumArtUrl: string | null;
  scrobbledAt: string | null;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryView() {
  const [tracks, setTracks] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data: RecentTrack[]) => setTracks(data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-warm-500 text-sm animate-pulse tracking-wide">
          Loading…
        </p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-warm-500 text-sm">No scrobbles found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col divide-y divide-warm-800/60">
        {tracks.map((track, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="w-12 h-12 rounded-md overflow-hidden bg-warm-800 shrink-0">
              {track.albumArtUrl ? (
                <Image
                  src={track.albumArtUrl}
                  alt={track.albumName ?? track.trackName}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-sm text-warm-600">♪</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-warm-100 text-sm font-medium truncate">
                {track.trackName}
              </p>
              <div className="flex items-center gap-1 min-w-0">
                <Link
                  href={`/artist/${encodeURIComponent(track.artistName)}`}
                  className="text-warm-400 text-xs truncate hover:text-warm-200 transition-colors"
                >
                  {track.artistName}
                </Link>
                {track.albumName && (
                  <span className="text-warm-600 text-xs truncate">
                    · {track.albumName}
                  </span>
                )}
              </div>
            </div>
            {track.scrobbledAt && (
              <div className="text-right shrink-0">
                <p className="font-mono text-warm-400 text-xs tabular-nums">
                  {timeAgo(track.scrobbledAt)}
                </p>
                <p className="font-mono text-warm-600 text-xs tabular-nums">
                  {formatTime(track.scrobbledAt)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
