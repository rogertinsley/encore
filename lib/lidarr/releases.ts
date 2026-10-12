/** A small, read-only bridge between MusicBrainz release groups and Lidarr. */
export type LidarrReleaseStatus =
  | "not-tracked"
  | "unmonitored"
  | "monitored"
  | "partial"
  | "downloaded";

interface LidarrAlbum {
  foreignAlbumId?: string;
  monitored?: boolean;
  statistics?: {
    trackCount?: number;
    trackFileCount?: number;
    percentOfTracks?: number;
  };
}

let cachedAlbums: Map<string, LidarrAlbum> | null = null;
let cacheUntil = 0;
let pending: Promise<Map<string, LidarrAlbum> | null> | null = null;
const CACHE_MS = 2 * 60 * 1000;

export function statusForRelease(
  releaseGroupMbid: string | null,
  albums: Map<string, LidarrAlbum>
): LidarrReleaseStatus {
  const album = releaseGroupMbid
    ? albums.get(releaseGroupMbid.toLowerCase())
    : undefined;
  if (!album) return "not-tracked";

  const files = album.statistics?.trackFileCount ?? 0;
  const total = album.statistics?.trackCount ?? 0;
  const percent = album.statistics?.percentOfTracks ?? 0;
  if (files > 0 && (percent >= 100 || (total > 0 && files >= total))) {
    return "downloaded";
  }
  if (files > 0) return "partial";
  return album.monitored ? "monitored" : "unmonitored";
}

async function fetchAlbums(): Promise<Map<string, LidarrAlbum> | null> {
  const baseUrl = process.env.LIDARR_URL;
  const apiKey = process.env.LIDARR_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const url = new URL("api/v1/album", `${baseUrl.replace(/\/$/, "")}/`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Lidarr returned ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected Lidarr response");
    const albums = new Map<string, LidarrAlbum>();
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const album = item as LidarrAlbum;
      if (typeof album.foreignAlbumId === "string") {
        albums.set(album.foreignAlbumId.toLowerCase(), album);
      }
    }
    cachedAlbums = albums;
    cacheUntil = Date.now() + CACHE_MS;
    return albums;
  } catch (error) {
    console.warn("[Lidarr] Could not load album status", error);
    // An outage should be shown as unknown, not as an empty library.
    return null;
  }
}

export async function getLidarrAlbums(): Promise<Map<
  string,
  LidarrAlbum
> | null> {
  if (cachedAlbums && Date.now() < cacheUntil) return cachedAlbums;
  if (!pending)
    pending = fetchAlbums().finally(() => {
      pending = null;
    });
  return pending;
}
