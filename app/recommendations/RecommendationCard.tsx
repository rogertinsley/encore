"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ArtistImages } from "@/lib/fanart/client";

interface Recommendation {
  id: string;
  artistName: string;
  sourceArtist: string;
  tags: string[];
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/artist-image?name=${encodeURIComponent(rec.artistName)}`)
      .then((r) => r.json())
      .then((images: ArtistImages | null) =>
        setThumbnail(images?.thumbnail ?? null)
      )
      .catch(() => null);
  }, [rec.artistName]);

  return (
    <Link
      href={`/artist/${encodeURIComponent(rec.artistName)}`}
      className="flex flex-col gap-3 bg-warm-900 rounded-xl overflow-hidden border border-warm-700 hover:border-warm-600 transition-all duration-300 hover:bg-warm-800/60 group"
    >
      <div className="relative w-full aspect-square bg-warm-800">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={rec.artistName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl text-warm-600">♪</span>
          </div>
        )}
      </div>
      <div className="px-3 pb-4 flex flex-col gap-2">
        <h3 className="text-warm-100 font-medium text-sm leading-tight group-hover:text-white transition-colors">
          {rec.artistName}
        </h3>
        <p className="text-warm-500 text-xs">
          Because you listen to{" "}
          <span className="text-warm-300">{rec.sourceArtist}</span>
        </p>
        {rec.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {rec.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-amber-accent/80 bg-amber-accent/10 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
