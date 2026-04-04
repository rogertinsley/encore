"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ArtistPageData } from "@/app/api/artist/[name]/route";
import { stripBio } from "@/lib/utils/bio";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

export function ArtistView({ artistName }: { artistName: string }) {
  const [data, setData] = useState<ArtistPageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/artist/${encodeURIComponent(artistName)}`)
      .then((r) => r.json())
      .then((json: ArtistPageData) => setData(json))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [artistName]);

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
        <p className="text-warm-500 text-sm">Artist not found.</p>
      </div>
    );
  }

  const bio = data.bio ? stripBio(data.bio) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="relative -mx-6 -mt-8 h-72 overflow-hidden rounded-b-lg">
        {data.artistImages?.background ? (
          <>
            <Image
              src={data.artistImages.background}
              alt={data.name}
              fill
              className="object-cover object-top"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/92" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-warm-800 to-warm-950" />
        )}

        {/* Artist name + thumbnail overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          {data.artistImages?.thumbnail && (
            <div className="w-16 h-16 rounded-full overflow-hidden bg-warm-800 shrink-0 border border-white/10">
              <Image
                src={data.artistImages.thumbnail}
                alt={data.name}
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="font-display text-3xl font-light text-white leading-tight tracking-tight">
              {data.name}
            </h1>
            <div className="flex items-center gap-3 font-mono text-xs text-white/45">
              <span>{formatNumber(data.listeners)} listeners</span>
              {data.userPlayCount != null && (
                <>
                  <span className="text-white/25">·</span>
                  <span>{formatNumber(data.userPlayCount)} plays</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-amber-accent/75 bg-amber-accent/10 px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Bio */}
      {bio && (
        <p className="text-sm text-warm-400 leading-relaxed max-w-2xl">{bio}</p>
      )}

      {/* Top Tracks */}
      {data.topTracks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display italic text-lg font-light text-warm-300">
            Top Tracks
          </h2>
          <div className="flex flex-col gap-1">
            {data.topTracks.map((track) => (
              <div
                key={track.name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-warm-800/50 transition-colors"
              >
                <span className="font-mono text-xs text-warm-600 w-4 shrink-0 text-right">
                  {track.rank}
                </span>
                <p className="text-sm text-warm-100 truncate flex-1">
                  {track.name}
                </p>
                <span className="font-mono text-xs text-warm-500 shrink-0">
                  {formatNumber(track.playCount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Albums */}
      {data.topAlbums.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display italic text-lg font-light text-warm-300">
            Albums
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.topAlbums.map((album) => (
              <div key={album.name} className="flex flex-col gap-1.5">
                <div className="aspect-square rounded-lg overflow-hidden bg-warm-800">
                  {album.coverArtUrl ? (
                    <Image
                      src={album.coverArtUrl}
                      alt={album.name}
                      width={200}
                      height={200}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl text-warm-600">♪</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-warm-200 truncate">{album.name}</p>
                {album.year && (
                  <p className="font-mono text-xs text-warm-500">
                    {album.year}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar Artists */}
      {data.similarArtists.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display italic text-lg font-light text-warm-300">
            Similar Artists
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.similarArtists.map((artist) => (
              <Link
                key={artist.name}
                href={`/artist/${encodeURIComponent(artist.name)}`}
                className="text-sm text-warm-300 bg-warm-900 hover:bg-warm-800 border border-warm-700 hover:border-warm-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {artist.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
