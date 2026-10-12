/** MusicBrainz release-group status and explicit Lidarr album actions. */
import { sameName } from "@/lib/shelf";
export type LidarrReleaseStatus =
  | "not-tracked"
  | "unmonitored"
  | "monitored"
  | "partial"
  | "downloaded";

export interface LidarrAlbum {
  id?: number;
  title?: string;
  artistId?: number;
  artist?: { artistName?: string; foreignArtistId?: string };
  foreignAlbumId?: string;
  monitored?: boolean;
  statistics?: {
    trackCount?: number;
    trackFileCount?: number;
    percentOfTracks?: number;
  };
}

function lidarrUrl(path: string): URL {
  const base = process.env.LIDARR_URL;
  if (!base || !process.env.LIDARR_API_KEY)
    throw new Error("Lidarr is not configured");
  const url = new URL(path, `${base.replace(/\/$/, "")}/`);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid Lidarr URL");
  return url;
}

async function lidarrRequest(
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const response = await fetch(lidarrUrl(path), {
    method,
    headers: {
      "X-Api-Key": process.env.LIDARR_API_KEY!,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Lidarr returned ${response.status}`);
  return response.json();
}

export function findShelfAlbum(
  albums: Map<string, LidarrAlbum>,
  item: {
    releaseGroupMbid: string | null;
    artistName: string;
    albumName: string | null;
  }
): LidarrAlbum | undefined {
  if (item.releaseGroupMbid)
    return albums.get(item.releaseGroupMbid.toLowerCase());
  if (!item.albumName) return undefined;
  return [...albums.values()].find(
    (album) =>
      sameName(album.title, item.albumName) &&
      sameName(album.artist?.artistName, item.artistName)
  );
}

export async function monitorShelfAlbum(album: LidarrAlbum): Promise<void> {
  if (!album.id) throw new Error("Album has no Lidarr ID");
  await lidarrRequest("api/v1/album/monitor", "PUT", {
    albumIds: [album.id],
    monitored: true,
  });
  cachedAlbums = null;
  cacheUntil = 0;
}

export async function addShelfAlbum(
  releaseGroupMbid: string,
  artistName: string,
  albumName: string
): Promise<void> {
  const lookup = await lidarrRequest(
    `api/v1/album/lookup?term=lidarr:${encodeURIComponent(releaseGroupMbid)}`
  );
  const candidates = Array.isArray(lookup) ? lookup : [];
  const match = candidates.find((value): value is LidarrAlbum =>
    Boolean(
      value &&
      typeof value === "object" &&
      (value as LidarrAlbum).foreignAlbumId?.toLowerCase() ===
        releaseGroupMbid.toLowerCase() &&
      sameName((value as LidarrAlbum).title, albumName) &&
      sameName((value as LidarrAlbum).artist?.artistName, artistName)
    )
  );
  if (!match) throw new Error("Lidarr could not verify this release");
  const artists = await lidarrRequest("api/v1/artist");
  const artist = Array.isArray(artists)
    ? artists.find(
        (value) =>
          value &&
          typeof value === "object" &&
          sameName(value.artistName, artistName) &&
          (!match.artist?.foreignArtistId ||
            value.foreignArtistId === match.artist.foreignArtistId)
      )
    : null;
  if (!artist?.id)
    throw new Error("Add this artist in Lidarr before adding the album");
  await lidarrRequest("api/v1/album", "POST", {
    ...match,
    id: 0,
    artistId: artist.id,
    artist,
    monitored: true,
    addOptions: { searchForNewAlbum: false },
  });
  cachedAlbums = null;
  cacheUntil = 0;
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
