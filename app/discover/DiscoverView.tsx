"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ArtistImages } from "@/lib/fanart/client";
import { timeAgo } from "@/lib/utils/time";

interface NewRelease {
  id: string;
  artistName: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  coverArtUrl: string | null;
  playCount: number;
}

interface Recommendation {
  id: string;
  artistName: string;
  sourceArtist: string;
  tags: string[];
}

interface RecentTrack {
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumArtUrl: string | null;
  scrobbledAt: string | null;
}

interface DiscoverData {
  releases: NewRelease[];
  recommendations: Recommendation[];
  recentTracks: RecentTrack[];
}

const TYPE_COLORS: Record<string, string> = {
  Album: "bg-violet-500/15 text-violet-300",
  EP: "bg-blue-500/15 text-blue-300",
  Single: "bg-emerald-500/15 text-emerald-300",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display italic text-lg font-light text-warm-300 mb-5">
      {children}
    </h2>
  );
}

// ── New Releases ─────────────────────────────────────────────────────────────

function ReleaseCard({ release }: { release: NewRelease }) {
  return (
    <Link
      href={`/artist/${encodeURIComponent(release.artistName)}`}
      className="flex flex-col gap-2 group"
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-warm-800">
        {release.coverArtUrl ? (
          <Image
            src={release.coverArtUrl}
            alt={release.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-warm-600">♪</span>
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm ${
            TYPE_COLORS[release.releaseType] ?? "bg-warm-800/80 text-warm-400"
          }`}
        >
          {release.releaseType}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-warm-100 text-sm font-medium leading-tight truncate group-hover:text-white transition-colors">
          {release.title}
        </p>
        <p className="text-warm-500 text-xs truncate">{release.artistName}</p>
      </div>
    </Link>
  );
}

function NewReleasesSection({ releases }: { releases: NewRelease[] }) {
  if (releases.length === 0) return null;
  return (
    <section>
      <SectionHeading>New Releases</SectionHeading>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {releases.map((r) => (
          <ReleaseCard key={r.id} release={r} />
        ))}
      </div>
    </section>
  );
}

// ── Recommended Artists ───────────────────────────────────────────────────────

function ArtistCard({ rec }: { rec: Recommendation }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [inLibrary, setInLibrary] = useState(false);

  useEffect(() => {
    fetch(`/api/artist-image?name=${encodeURIComponent(rec.artistName)}`)
      .then((r) => r.json())
      .then((images: ArtistImages | null) =>
        setThumbnail(images?.thumbnail ?? null)
      )
      .catch(() => null);

    fetch(`/api/eversolo/library?artist=${encodeURIComponent(rec.artistName)}`)
      .then((r) => r.json())
      .then((data: { inLibrary: boolean }) => setInLibrary(data.inLibrary))
      .catch(() => null);
  }, [rec.artistName]);

  return (
    <Link
      href={`/artist/${encodeURIComponent(rec.artistName)}`}
      className="flex flex-col gap-2 shrink-0 w-32 group"
    >
      <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-warm-800">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={rec.artistName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-warm-600">♪</span>
          </div>
        )}
        {inLibrary && (
          <span className="absolute bottom-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 backdrop-blur-sm">
            In library
          </span>
        )}
      </div>
      <div>
        <p className="text-warm-100 text-xs font-medium truncate group-hover:text-white transition-colors">
          {rec.artistName}
        </p>
        <p className="text-warm-500 text-xs truncate">
          Like {rec.sourceArtist}
        </p>
      </div>
    </Link>
  );
}

function RecommendationsSection({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  if (recommendations.length === 0) return null;
  return (
    <section>
      <SectionHeading>Recommended For You</SectionHeading>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {recommendations.map((rec) => (
          <ArtistCard key={rec.id} rec={rec} />
        ))}
      </div>
    </section>
  );
}

// ── Recently Played ───────────────────────────────────────────────────────────

function RecentlyPlayedSection({ tracks }: { tracks: RecentTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <section>
      <SectionHeading>Recently Played</SectionHeading>
      <div className="flex flex-col divide-y divide-warm-800/60">
        {tracks.map((track, i) => (
          <div key={i} className="flex items-center gap-4 py-3 group">
            <div className="w-10 h-10 rounded-md overflow-hidden bg-warm-800 shrink-0">
              {track.albumArtUrl ? (
                <Image
                  src={track.albumArtUrl}
                  alt={track.albumName ?? track.trackName}
                  width={40}
                  height={40}
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
              <Link
                href={`/artist/${encodeURIComponent(track.artistName)}`}
                className="text-warm-500 text-xs truncate hover:text-warm-300 transition-colors block"
              >
                {track.artistName}
                {track.albumName ? ` · ${track.albumName}` : ""}
              </Link>
            </div>
            {track.scrobbledAt && (
              <p className="font-mono text-warm-500 text-xs shrink-0 tabular-nums">
                {timeAgo(track.scrobbledAt)}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DiscoverView() {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json())
      .then((json: DiscoverData) => setData(json))
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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-warm-500 text-sm">Something went wrong.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <NewReleasesSection releases={data.releases} />
      <RecommendationsSection recommendations={data.recommendations} />
      <RecentlyPlayedSection tracks={data.recentTracks} />
    </div>
  );
}
