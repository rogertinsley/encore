"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EditorialData } from "@/app/api/editorial/route";
import type { NewsItem } from "@/lib/news/service";

function LeadStory({ lead }: { lead: NonNullable<EditorialData["lead"]> }) {
  return (
    <section className="relative w-full min-h-[50vh] md:min-h-[70vh] flex items-end overflow-hidden rounded-xl mb-12">
      {/* Background */}
      {lead.backgroundUrl ? (
        <Image
          src={lead.backgroundUrl}
          alt={lead.artistName}
          fill
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-warm-900" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full p-8 md:p-12 flex gap-8 items-end">
        {lead.albumArtUrl && (
          <div className="hidden md:block shrink-0 w-32 h-32 rounded-lg overflow-hidden shadow-2xl border border-white/10">
            <Image
              src={lead.albumArtUrl}
              alt={lead.albumName ?? lead.artistName}
              width={128}
              height={128}
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45 mb-3 font-sans font-light">
            Now Playing
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-light text-white leading-none mb-2 tracking-tight">
            <Link
              href={`/artist/${encodeURIComponent(lead.artistName)}`}
              className="hover:text-warm-200 transition-colors"
            >
              {lead.artistName}
            </Link>
          </h1>
          {lead.albumName && (
            <p className="font-display italic text-xl text-white/55 mb-6">
              {lead.albumName}
            </p>
          )}
          {lead.pullQuote && (
            <blockquote className="border-l border-amber-accent/50 pl-5 mb-6">
              <p className="font-display italic text-2xl md:text-3xl text-white/85 font-light leading-snug">
                &ldquo;{lead.pullQuote}&rdquo;
              </p>
            </blockquote>
          )}
          <div className="text-sm text-white/65 leading-relaxed space-y-3 max-w-2xl">
            {lead.review.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WeeklyDigest({ content }: { content: string }) {
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-lg font-light text-warm-300 mb-4">
        This Week in Your Listening
      </h2>
      <p className="text-warm-300 text-base leading-relaxed max-w-2xl">
        {content}
      </p>
    </section>
  );
}

function AlbumReviews({ reviews }: { reviews: EditorialData["albumReviews"] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-lg font-light text-warm-300 mb-6">
        Albums of the Week
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((r) => (
          <article
            key={`${r.artistName}-${r.albumName}`}
            className="flex flex-col gap-3"
          >
            <div className="aspect-square w-full rounded-lg overflow-hidden bg-warm-800">
              {r.imageUrl ? (
                <Image
                  src={r.imageUrl}
                  alt={r.albumName}
                  width={300}
                  height={300}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl text-warm-600">♪</span>
                </div>
              )}
            </div>
            <div>
              <Link
                href={`/artist/${encodeURIComponent(r.artistName)}`}
                className="text-xs text-warm-500 hover:text-warm-300 transition-colors uppercase tracking-wider"
              >
                {r.artistName}
              </Link>
              <h3 className="text-warm-100 font-medium text-sm mt-0.5 mb-2">
                {r.albumName}
              </h3>
              {r.pullQuote && (
                <p className="font-display italic text-warm-400 text-sm mb-2 leading-snug">
                  &ldquo;{r.pullQuote}&rdquo;
                </p>
              )}
              <p className="text-warm-500 text-xs leading-relaxed">
                {r.review}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtistSpotlight({
  spotlight,
}: {
  spotlight: NonNullable<EditorialData["artistSpotlight"]>;
}) {
  return (
    <section className="border border-warm-700 rounded-xl p-6 flex gap-6 items-start mb-10">
      {spotlight.imageUrl && (
        <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-warm-800">
          <Image
            src={spotlight.imageUrl}
            alt={spotlight.artistName}
            width={80}
            height={80}
            className="object-cover w-full h-full"
          />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-warm-500 mb-1 font-light">
          Did You Know?
        </p>
        <Link
          href={`/artist/${encodeURIComponent(spotlight.artistName)}`}
          className="text-warm-100 font-medium text-sm hover:text-white transition-colors"
        >
          {spotlight.artistName}
        </Link>
        <p className="text-warm-400 text-sm leading-relaxed mt-2">
          {spotlight.content}
        </p>
      </div>
    </section>
  );
}

function InThePress({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-lg font-light text-warm-300 mb-6">
        In the Press
      </h2>
      <div className="flex flex-col divide-y divide-warm-800/60">
        {items.map((item, i) => (
          <article key={i} className="py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-warm-600 uppercase tracking-wider">
                {item.source}
              </span>
              <span className="text-warm-700 text-xs">·</span>
              <Link
                href={`/artist/${encodeURIComponent(item.matchedArtist)}`}
                className="text-xs text-warm-500 hover:text-warm-300 transition-colors"
              >
                {item.matchedArtist}
              </Link>
              {item.publishedAt && (
                <>
                  <span className="text-warm-700 text-xs">·</span>
                  <span className="font-mono text-xs text-warm-600 tabular-nums">
                    {new Date(item.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-warm-100 text-sm font-medium hover:text-white transition-colors leading-snug"
            >
              {item.title}
            </a>
            {item.summary && (
              <p className="text-warm-500 text-xs leading-relaxed line-clamp-2">
                {item.summary}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="rounded-xl bg-warm-800/50 min-h-[70vh]" />
      <div className="space-y-3 max-w-2xl">
        <div className="h-3 bg-warm-800 rounded w-32" />
        <div className="h-4 bg-warm-800 rounded w-full" />
        <div className="h-4 bg-warm-800 rounded w-5/6" />
        <div className="h-4 bg-warm-800 rounded w-4/6" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square bg-warm-800 rounded-lg" />
            <div className="h-3 bg-warm-800 rounded w-2/3" />
            <div className="h-3 bg-warm-800 rounded w-full" />
            <div className="h-3 bg-warm-800 rounded w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditorialView() {
  const [data, setData] = useState<EditorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/editorial")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: EditorialData) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-warm-500 text-sm">
          Could not load editorial content.
        </p>
      </div>
    );
  }

  const hasContent =
    data.lead ||
    data.weeklyDigest ||
    data.albumReviews.length > 0 ||
    data.artistSpotlight ||
    data.news.length > 0;

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-warm-500 text-sm">
          Start playing music to generate your editorial.
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.lead && <LeadStory lead={data.lead} />}
      {data.weeklyDigest && <WeeklyDigest content={data.weeklyDigest} />}
      {data.albumReviews.length > 0 && (
        <AlbumReviews reviews={data.albumReviews} />
      )}
      {data.artistSpotlight && (
        <ArtistSpotlight spotlight={data.artistSpotlight} />
      )}
      {data.news.length > 0 && <InThePress items={data.news} />}
    </div>
  );
}
