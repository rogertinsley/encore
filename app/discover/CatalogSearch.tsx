"use client";

import { baseAlbumTitle } from "@/lib/album-title";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ReleaseAction } from "@/app/components/ReleaseAction";
import type { ReleaseProgress } from "@/lib/lidarr/progress";

interface Results {
  artists: Array<{ id: string; name: string; disambiguation?: string }>;
  releases: Array<{
    mbid: string;
    title: string;
    artistName: string;
    releaseDate: string | null;
    releaseType: string | null;
    lidarrStatus: ReleaseProgress | null;
  }>;
  lidarrConfigured: boolean;
}

export function CatalogSearch({
  album,
  artist,
}: {
  album: string;
  artist: string;
}) {
  const [query, setQuery] = useState(album);
  const [type, setType] = useState<"artist" | "album">(
    album ? "album" : "artist"
  );
  const [results, setResults] = useState<Results | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);

  const search = useCallback(
    async (query: string, type: "artist" | "album", artist?: string) => {
      if (!query.trim()) return;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setPending(true);
      setError("");
      setResults(null);
      try {
        const params = new URLSearchParams({ q: query.trim(), type });
        if (type === "album" && artist) params.set("artist", artist);
        const response = await fetch(`/api/explore?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Search is temporarily unavailable. Try again.");
        const data = (await response.json()) as Results;
        if (!controller.signal.aborted) setResults(data);
      } catch {
        if (!controller.signal.aborted)
          setError("Search is temporarily unavailable. Try again.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    },
    []
  );

  useEffect(() => {
    if (album) void search(baseAlbumTitle(album), "album", artist);
    return () => active.current?.abort();
  }, [album, artist, search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(
      query === album ? baseAlbumTitle(query) : query,
      type,
      query === album ? artist : undefined
    );
  }

  return (
    <section
      aria-label="Catalog search"
      className="mb-10 border-b border-warm-700 pb-6"
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-warm-300">
          Search by
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value === "album" ? "album" : "artist")
            }
            className="min-h-11 rounded border border-warm-600 bg-warm-900 px-3 text-warm-100"
          >
            <option value="artist">Artist</option>
            <option value="album">Album</option>
          </select>
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm text-warm-300">
          {type === "album" ? "Album title" : "Artist name"}
          <input
            type="search"
            required
            maxLength={120}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 rounded border border-warm-600 bg-warm-900 px-3 text-base text-warm-100"
          />
        </label>
        <button className="min-h-11 rounded bg-amber-accent px-5 text-sm font-medium text-warm-950 hover:brightness-110">
          Search
        </button>
      </form>
      <p role="status" className="mt-3 text-sm text-warm-300">
        {pending
          ? "Searching MusicBrainz…"
          : error ||
            (results && !results.artists.length && !results.releases.length
              ? "No matches found."
              : "")}
      </p>
      {results && (
        <ul aria-label="Search results" className="divide-y divide-warm-700">
          {results.artists.map((artist) => (
            <li key={artist.id} className="py-3">
              <Link
                className="text-base hover:text-amber-accent"
                href={`/artist/${encodeURIComponent(artist.name)}`}
              >
                {artist.name}
              </Link>
              {artist.disambiguation && (
                <p className="text-sm text-warm-300">{artist.disambiguation}</p>
              )}
            </li>
          ))}
          {results.releases.map((release) => (
            <li
              key={release.mbid}
              className="flex flex-wrap justify-between gap-x-5 gap-y-2 py-3"
            >
              <div>
                <h2 className="font-display text-2xl text-warm-100">
                  {release.title}
                </h2>
                <Link
                  className="text-sm text-warm-300 hover:text-amber-accent"
                  href={`/artist/${encodeURIComponent(release.artistName)}`}
                >
                  {release.artistName}
                </Link>
                {release.releaseDate && (
                  <span className="text-sm text-warm-300">
                    {" "}
                    · {release.releaseDate.slice(0, 4)}
                  </span>
                )}
              </div>
              <ReleaseAction
                mbid={release.mbid}
                path={
                  results.lidarrConfigured && release.artistName
                    ? `/api/releases/${release.mbid}/lidarr`
                    : null
                }
                status={release.lidarrStatus}
                releaseDate={release.releaseDate}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
