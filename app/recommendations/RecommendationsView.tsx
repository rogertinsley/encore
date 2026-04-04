"use client";

import { useEffect, useState } from "react";
import { RecommendationCard } from "./RecommendationCard";

interface Recommendation {
  id: string;
  artistName: string;
  sourceArtist: string;
  tags: string[];
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  lastRunAt: string | null;
}

export function RecommendationsView() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((json: RecommendationsResponse) => setData(json))
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

  if (!data || data.recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-warm-500 text-sm">
          No recommendations yet — check back soon.
        </p>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display italic text-2xl font-light text-warm-100">
          Recommendations
        </h1>
        {lastRun && (
          <p className="font-mono text-xs text-warm-500">Updated {lastRun}</p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.recommendations.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}
