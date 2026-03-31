"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AnalyticsData } from "@/app/api/analytics/route";
import type { Period } from "@/lib/lastfm/client";

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "7day", label: "7 days" },
  { value: "1month", label: "1 month" },
  { value: "3month", label: "3 months" },
  { value: "6month", label: "6 months" },
  { value: "12month", label: "12 months" },
  { value: "overall", label: "All time" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function yearsAgo(iso: string): string {
  const years = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365)
  );
  return years === 1 ? "1 year" : `${years} years`;
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ data }: { data: AnalyticsData }) {
  const stats = [
    { label: "Total Scrobbles", value: fmt(data.userInfo.totalScrobbles) },
    { label: "Listening Since", value: yearsAgo(data.userInfo.registeredAt) },
    { label: "Artists This Period", value: fmt(data.topArtists.length) },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-10">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"
        >
          <p className="text-3xl font-bold text-white tabular-nums">
            {s.value}
          </p>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Top artists chart ─────────────────────────────────────────────────────────

function TopArtistsChart({
  artists,
}: {
  artists: AnalyticsData["topArtists"];
}) {
  const max = artists[0]?.playCount ?? 1;
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        Top Artists
      </h2>
      <div className="flex flex-col gap-2">
        {artists.slice(0, 10).map((a, i) => {
          const pct = (a.playCount / max) * 100;
          const opacity = 1 - i * 0.06;
          return (
            <div key={a.name} className="flex items-center gap-3">
              <span className="text-zinc-600 text-xs w-4 shrink-0 tabular-nums">
                {a.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Link
                    href={`/artist/${encodeURIComponent(a.name)}`}
                    className="text-sm text-white hover:text-zinc-300 transition-colors truncate"
                  >
                    {a.name}
                  </Link>
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0 ml-2">
                    {fmt(a.playCount)}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(to right, #10b981, #34d399)`,
                      opacity,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Top tracks list ───────────────────────────────────────────────────────────

function TopTracksList({ tracks }: { tracks: AnalyticsData["topTracks"] }) {
  const max = tracks[0]?.playCount ?? 1;
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        Top Tracks
      </h2>
      <div className="flex flex-col gap-1">
        {tracks.slice(0, 10).map((t, i) => {
          const pct = (t.playCount / max) * 100;
          return (
            <div
              key={`${t.artistName}-${t.name}`}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg overflow-hidden"
            >
              {/* Background bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: "rgba(16,185,129,0.07)",
                }}
              />
              <span className="relative text-zinc-600 text-xs w-4 shrink-0 tabular-nums">
                {i + 1}
              </span>
              <div className="relative flex-1 min-w-0">
                <p className="text-sm text-white truncate leading-tight">
                  {t.name}
                </p>
                <p className="text-xs text-zinc-500 truncate">{t.artistName}</p>
              </div>
              <span className="relative text-xs text-zinc-500 tabular-nums shrink-0">
                {fmt(t.playCount)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Top albums grid ───────────────────────────────────────────────────────────

function TopAlbumsGrid({ albums }: { albums: AnalyticsData["topAlbums"] }) {
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        Top Albums
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {albums.slice(0, 12).map((a) => (
          <div
            key={`${a.artistName}-${a.name}`}
            className="flex flex-col gap-1.5"
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-zinc-800">
              {a.imageUrl ? (
                <Image
                  src={a.imageUrl}
                  alt={a.name}
                  width={120}
                  height={120}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl text-zinc-700">♪</span>
                </div>
              )}
            </div>
            <p className="text-xs text-white truncate leading-tight">
              {a.name}
            </p>
            <p className="text-xs text-zinc-500 truncate">{a.artistName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Genre breakdown ───────────────────────────────────────────────────────────

function GenreChart({ tags }: { tags: AnalyticsData["topTags"] }) {
  const max = tags[0]?.count ?? 1;
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        Genre Breakdown
      </h2>
      <div className="flex flex-col gap-2">
        {tags.slice(0, 12).map((tag, i) => {
          const pct = (tag.count / max) * 100;
          const opacity = 1 - i * 0.055;
          return (
            <div key={tag.name} className="flex items-center gap-3">
              <span className="text-xs text-white capitalize w-28 shrink-0 truncate">
                {tag.name}
              </span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, #8b5cf6, #a78bfa)`,
                    opacity,
                  }}
                />
              </div>
              <span className="text-xs text-zinc-500 tabular-nums w-8 text-right shrink-0">
                {tag.count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── New artists discovered ────────────────────────────────────────────────────

function NewArtists({ artists }: { artists: AnalyticsData["newArtists"] }) {
  if (artists.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        New Discoveries
      </h2>
      <div className="flex flex-wrap gap-2">
        {artists.map((a) => (
          <Link
            key={a.name}
            href={`/artist/${encodeURIComponent(a.name)}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-sm text-white group-hover:text-zinc-200">
              {a.name}
            </span>
            <span className="text-xs text-zinc-500">{fmt(a.playCount)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Listening heatmap ─────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function ListeningHeatmap({ heatmap }: { heatmap: AnalyticsData["heatmap"] }) {
  const allValues = heatmap.flat();
  const max = Math.max(...allValues, 1);

  function cellColor(count: number): string {
    if (count === 0) return "bg-zinc-800/60";
    const intensity = count / max;
    if (intensity < 0.2) return "bg-emerald-900/60";
    if (intensity < 0.4) return "bg-emerald-800/70";
    if (intensity < 0.6) return "bg-emerald-700/80";
    if (intensity < 0.8) return "bg-emerald-600";
    return "bg-emerald-400";
  }

  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 font-medium">
        Listening Heatmap
      </h2>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hour labels */}
          <div className="flex mb-1 ml-10">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center">
                {h % 6 === 0 && (
                  <span className="text-zinc-600 text-xs">
                    {h === 0
                      ? "12am"
                      : h === 12
                        ? "12pm"
                        : h > 12
                          ? `${h - 12}pm`
                          : `${h}am`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, d) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-zinc-600 text-xs w-9 shrink-0">{day}</span>
              <div className="flex flex-1 gap-0.5">
                {HOURS.map((h) => {
                  const count = heatmap[d]?.[h] ?? 0;
                  return (
                    <div
                      key={h}
                      title={`${day} ${h}:00 — ${count} scrobbles`}
                      className={`flex-1 h-5 rounded-sm transition-colors ${cellColor(count)}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 ml-10">
            <span className="text-zinc-600 text-xs">Less</span>
            {[
              "bg-zinc-800/60",
              "bg-emerald-900/60",
              "bg-emerald-700/80",
              "bg-emerald-600",
              "bg-emerald-400",
            ].map((c) => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-zinc-600 text-xs">More</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-zinc-800 rounded-xl h-24" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-8 bg-zinc-800 rounded-lg"
            style={{ width: `${90 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>("1month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then((d: AnalyticsData) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              period === p.value
                ? "bg-white text-zinc-900 font-medium"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton />
      ) : !data ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500 text-sm">Could not load analytics.</p>
        </div>
      ) : (
        <>
          <StatsBar data={data} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <TopArtistsChart artists={data.topArtists} />
            <TopTracksList tracks={data.topTracks} />
          </div>
          <TopAlbumsGrid albums={data.topAlbums} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <GenreChart tags={data.topTags} />
            <NewArtists artists={data.newArtists} />
          </div>
          <ListeningHeatmap heatmap={data.heatmap} />
        </>
      )}
    </div>
  );
}
