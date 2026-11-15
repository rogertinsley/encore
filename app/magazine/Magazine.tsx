"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MagazineData } from "@/app/api/magazine/route";
import type { EditorialData } from "@/lib/editorial/service";
import type { LidarrReleaseStatus } from "@/lib/lidarr/releases";
import styles from "./magazine.module.css";

type Release = MagazineData["releases"][number];
type Recommendation = MagazineData["recommendations"][number];

interface Feature {
  title: string;
  artistName: string;
  subtitle: string | null;
  copy: string | null;
  imageUrl: string | null;
  wide: boolean;
  link: string;
  linkLabel: string;
}

const releaseStatus: Record<LidarrReleaseStatus, string> = {
  "not-tracked": "Not in Lidarr",
  unmonitored: "Unmonitored",
  monitored: "Monitored",
  partial: "Partly imported",
  downloaded: "In your library",
};

function artistPath(artist: string) {
  return `/artist/${encodeURIComponent(artist)}`;
}

function dateLabel(date: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(date));
}

async function getData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function Artwork({
  url,
  sizes,
  priority = false,
}: {
  url: string | null;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return url && !failed ? (
    <Image
      src={url}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
    />
  ) : null;
}

function Action({ path, label }: { path: string; label: string }) {
  const [result, setResult] = useState<{ message: string; ok: boolean } | null>(
    null
  );
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const data = (await response.json()) as { message: string };
      setResult({ message: data.message, ok: response.ok });
    } catch {
      setResult({ message: "Could not reach Lidarr. Try again.", ok: false });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.action}>
      {(!result || !result.ok) && (
        <button type="button" disabled={pending} onClick={submit}>
          {pending ? "Sending…" : label}
        </button>
      )}
      <span
        role="status"
        className={result?.ok ? styles.success : styles.actionError}
      >
        {result?.message}
      </span>
    </div>
  );
}

function ArtistPick({
  artist,
  lidarrConfigured,
}: {
  artist: Recommendation;
  lidarrConfigured: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getData<{ thumbnail: string | null; background: string | null } | null>(
      `/api/artist-image?name=${encodeURIComponent(artist.artistName)}`,
      controller.signal
    )
      .then((data) => setImage(data?.thumbnail ?? data?.background ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [artist.artistName]);

  return (
    <article className={styles.pick}>
      <Link
        href={artistPath(artist.artistName)}
        className={styles.pickArt}
        aria-label={artist.artistName}
      >
        <Artwork
          key={image}
          url={image}
          sizes="(max-width: 600px) 92vw, (max-width: 900px) 45vw, 400px"
        />
      </Link>
      <div className={styles.pickText}>
        <h3>
          <Link href={artistPath(artist.artistName)}>{artist.artistName}</Link>
        </h3>
        <p>
          Because you listen to{" "}
          <Link href={artistPath(artist.sourceArtist)}>
            {artist.sourceArtist}
          </Link>
        </p>
        {lidarrConfigured && (
          <Action
            path={`/api/recommendations/${encodeURIComponent(artist.id)}/lidarr`}
            label={
              artist.lidarrTracked
                ? "Search missing albums"
                : "Add artist & search"
            }
          />
        )}
      </div>
    </article>
  );
}

function ReleaseRow({
  release,
  lidarrConfigured,
}: {
  release: Release;
  lidarrConfigured: boolean;
}) {
  const upcoming = Date.parse(release.releaseDate) > Date.now();
  const canSend =
    lidarrConfigured &&
    release.mbid &&
    release.lidarrStatus !== "downloaded" &&
    (release.artistTracked !== false ||
      (release.lidarrStatus && release.lidarrStatus !== "not-tracked"));
  const actionLabel = upcoming
    ? "Monitor release"
    : release.lidarrStatus === "not-tracked"
      ? "Add & search"
      : "Search in Lidarr";

  return (
    <li className={styles.release}>
      <div className={styles.releaseArt}>
        <Artwork
          key={release.coverArtUrl}
          url={release.coverArtUrl}
          sizes="64px"
        />
      </div>
      <div className={styles.releaseText}>
        <p className={styles.dateline}>
          <time dateTime={release.releaseDate}>
            {dateLabel(release.releaseDate)}
          </time>{" "}
          · {release.releaseType}
        </p>
        <h3>{release.title}</h3>
        <Link href={artistPath(release.artistName)}>{release.artistName}</Link>
        {release.lidarrStatus && (
          <span className={styles.releaseStatus}>
            {releaseStatus[release.lidarrStatus]}
          </span>
        )}
        {canSend && !(upcoming && release.lidarrStatus === "monitored") && (
          <Action
            path={`/api/new-releases/${encodeURIComponent(release.id)}/lidarr`}
            label={actionLabel}
          />
        )}
      </div>
    </li>
  );
}

function selectFeature(
  data: MagazineData | null,
  editorial: EditorialData | null
): Feature | null {
  const lead = editorial?.lead;
  const review = editorial?.albumReviews[0];
  const story = lead?.review ? lead : review;
  if (story) {
    return {
      title: story.albumName ?? story.artistName,
      artistName: story.artistName,
      subtitle: story.albumName ? story.artistName : null,
      copy: story.pullQuote || story.review.split("\n\n")[0],
      imageUrl:
        "backgroundUrl" in story
          ? (story.backgroundUrl ?? story.albumArtUrl)
          : story.imageUrl,
      wide: "backgroundUrl" in story && Boolean(story.backgroundUrl),
      link: "/editorial",
      linkLabel: "Read the editorial",
    };
  }

  const current = data?.nowPlaying;
  const track = current ?? data?.recentTracks[0];
  if (track) {
    return {
      title: track.albumName ?? track.trackName,
      artistName: track.artistName,
      subtitle: track.artistName,
      copy: null,
      imageUrl: track.albumArtUrl,
      wide: false,
      link: artistPath(track.artistName),
      linkLabel: "Explore artist",
    };
  }
  return null;
}

export function Magazine() {
  const [data, setData] = useState<MagazineData | null>(null);
  const [editorial, setEditorial] = useState<EditorialData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getData<MagazineData>("/api/magazine", controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    getData<EditorialData>("/api/editorial", controller.signal)
      .then(setEditorial)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const feature = selectFeature(data, editorial);
  const releases =
    data?.releases
      .filter((release) => Date.parse(release.releaseDate) <= Date.now())
      .slice(0, 4) ?? [];
  const upcoming = data?.releases.find(
    (release) => Date.parse(release.releaseDate) > Date.now()
  );
  const picks = data?.recommendations.slice(0, 3) ?? [];
  const run = data?.weeklyRun;

  return (
    <div className={styles.magazine}>
      <header className={styles.masthead}>
        <h1>Music magazine</h1>
        <div className={styles.mastheadLinks}>
          <Link href="/now-playing">Now playing</Link>
          <Link href="/display" className={styles.display}>
            Open Display
          </Link>
        </div>
      </header>

      <div className={styles.edition}>
        <section className={styles.feature} aria-labelledby="magazine-feature">
          {feature?.imageUrl && (
            <div
              className={`${styles.featureArt} ${feature.wide ? styles.wideArt : ""}`}
            >
              <Artwork
                key={feature.imageUrl}
                url={feature.imageUrl}
                sizes="(max-width: 900px) 95vw, 800px"
                priority
              />
            </div>
          )}
          <div className={styles.featureCopy}>
            <h2 id="magazine-feature">
              {feature?.title ?? "Your listening journal"}
            </h2>
            {feature?.subtitle && (
              <Link
                className={styles.byline}
                href={artistPath(feature.artistName)}
              >
                {feature.subtitle}
              </Link>
            )}
            {feature?.copy && <p className={styles.excerpt}>{feature.copy}</p>}
            {!feature && (
              <p role="status">
                {failed
                  ? "Couldn’t load your listening history."
                  : data
                    ? "Recent listening will appear here."
                    : "Loading your listening…"}
              </p>
            )}
            <Link
              className={styles.textLink}
              href={feature?.link ?? "/editorial"}
            >
              {feature?.linkLabel ?? "Open editorial"}
            </Link>
          </div>
        </section>

        <section
          className={styles.releases}
          aria-labelledby="magazine-releases"
        >
          <div className={styles.sectionHeading}>
            <h2 id="magazine-releases">New releases</h2>
            <Link href="/discover">All releases</Link>
          </div>
          {releases.length > 0 ? (
            <ul>
              {releases.map((release) => (
                <ReleaseRow
                  key={release.id}
                  release={release}
                  lidarrConfigured={Boolean(data?.lidarrConfigured)}
                />
              ))}
            </ul>
          ) : (
            <p role="status">
              {failed
                ? "Couldn’t load releases."
                : data
                  ? "No new releases in your feed."
                  : "Loading releases…"}
            </p>
          )}
          {upcoming && (
            <>
              <h3 className={styles.upcoming}>Coming soon</h3>
              <ul>
                <ReleaseRow
                  key={upcoming.id}
                  release={upcoming}
                  lidarrConfigured={Boolean(data?.lidarrConfigured)}
                />
              </ul>
            </>
          )}
        </section>
      </div>

      <section
        className={styles.discovery}
        aria-labelledby="magazine-discovery"
      >
        <div className={styles.sectionHeading}>
          <h2 id="magazine-discovery">Artists to discover</h2>
          <Link href="/recommendations">All recommendations</Link>
        </div>
        {data?.lidarrConfigured && (
          <p className={styles.discoveryNote}>
            Weekly discovery adds up to three artists to Lidarr and searches
            their albums.
          </p>
        )}
        {picks.length > 0 ? (
          <div className={styles.picks}>
            {picks.map((artist) => (
              <ArtistPick
                key={artist.id}
                artist={artist}
                lidarrConfigured={Boolean(data?.lidarrConfigured)}
              />
            ))}
          </div>
        ) : (
          <p role="status">
            {failed
              ? "Couldn’t load recommendations."
              : data
                ? "Recommendations appear as Encore learns from your listening."
                : "Loading recommendations…"}
          </p>
        )}
      </section>

      {data?.lidarrConfigured && (
        <section
          className={styles.activity}
          aria-labelledby="magazine-activity"
        >
          <div>
            <h2 id="magazine-activity">Lidarr activity</h2>
            <p>
              {run
                ? `Weekly sync · ${dateLabel(run.finishedAt, true)} · ${run.addedArtists} artists added · ${run.added} releases added · ${run.searched} releases sent for search${run.failed ? " · Finished with errors" : ""}`
                : "The latest weekly sync will appear here."}
            </p>
          </div>
          <Link className={styles.textLink} href="/activity">
            View searches and imports
          </Link>
        </section>
      )}
    </div>
  );
}
