"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface NewRelease {
  id: string;
  artistName: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  coverArtUrl: string | null;
  playCount: number;
}

interface NewReleasesResponse {
  releases: NewRelease[];
  lastRunAt: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  Album: "bg-violet-500/15 text-violet-300",
  EP: "bg-blue-500/15 text-blue-300",
  Single: "bg-emerald-500/15 text-emerald-300",
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

function groupByDate(releases: NewRelease[]): [string, NewRelease[]][] {
  const map = new Map<string, NewRelease[]>();
  for (const r of releases) {
    const day = r.releaseDate.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  }
  for (const group of map.values()) {
    group.sort((a, b) => b.playCount - a.playCount);
  }
  return Array.from(map.entries());
}

export function NewReleasesView() {
  const [data, setData] = useState<NewReleasesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/new-releases")
      .then((r) => r.json())
      .then((json: NewReleasesResponse) => setData(json))
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

  if (!data || data.releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-warm-500 text-sm">No new releases found yet.</p>
        <p className="text-warm-600 text-xs">
          The daily job runs on server start and every 24 hours.
        </p>
      </div>
    );
  }

  const lastRun = data.lastRunAt
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.lastRunAt))
    : null;

  const groups = groupByDate(data.releases);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display italic text-2xl font-light text-warm-100">
          New Releases
        </h1>
        {lastRun && (
          <p className="font-mono text-xs text-warm-500">Updated {lastRun}</p>
        )}
      </div>

      {groups.map(([date, releases]) => (
        <section key={date} className="flex flex-col gap-3">
          <h2 className="font-display italic text-base text-warm-400 font-light">
            {formatDate(date)}
          </h2>
          <div className="flex flex-col gap-1.5">
            {releases.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 bg-warm-900 rounded-xl p-3 border border-warm-700 hover:border-warm-600 hover:bg-warm-800/50 transition-all duration-200"
              >
                {/* Album art */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-warm-800 shrink-0">
                  {r.coverArtUrl ? (
                    <Image
                      src={r.coverArtUrl}
                      alt={r.title}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xl text-warm-600">♪</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p className="text-warm-100 text-sm font-medium truncate">
                    {r.title}
                  </p>
                  <Link
                    href={`/artist/${encodeURIComponent(r.artistName)}`}
                    className="text-warm-400 text-xs truncate hover:text-warm-200 transition-colors"
                  >
                    {r.artistName}
                  </Link>
                </div>

                {/* Type badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    TYPE_COLORS[r.releaseType] ?? "bg-warm-800 text-warm-400"
                  }`}
                >
                  {r.releaseType}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
