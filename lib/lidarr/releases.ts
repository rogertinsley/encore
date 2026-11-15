/** MusicBrainz release-group status and explicit Lidarr album actions. */
import { sameName } from "@/lib/shelf";
export const LIDARR_WEB_URL = "https://lidarr.rogertinsley.com";

export class LidarrReleaseActionError extends Error {
  constructor(
    message: string,
    readonly status: 409 | 502 = 409
  ) {
    super(message);
  }
}

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
  const base = process.env.LIDARR_URL || LIDARR_WEB_URL;
  if (!process.env.LIDARR_API_KEY) throw new Error("Lidarr is not configured");
  const url = new URL(path, `${base.replace(/\/$/, "")}/`);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid Lidarr URL");
  return url;
}

export async function lidarrRequest(
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
    redirect: "error",
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
): Promise<LidarrAlbum> {
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
  if (!match)
    throw new LidarrReleaseActionError("Lidarr could not verify this release");
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
    throw new LidarrReleaseActionError(
      "Add this artist in Lidarr before adding the album"
    );
  const added = (await lidarrRequest("api/v1/album", "POST", {
    ...match,
    id: 0,
    artistId: artist.id,
    artist,
    monitored: true,
    addOptions: { searchForNewAlbum: false },
  })) as LidarrAlbum;
  cachedAlbums = null;
  cacheUntil = 0;
  return added;
}

let cachedAlbums: Map<string, LidarrAlbum> | null = null;
let cacheUntil = 0;
let pending: Promise<Map<string, LidarrAlbum> | null> | null = null;
const CACHE_MS = 2 * 60 * 1000;

function hasAllTracks(album: LidarrAlbum): boolean {
  const files = album.statistics?.trackFileCount ?? 0;
  const total = album.statistics?.trackCount ?? 0;
  const percent = album.statistics?.percentOfTracks ?? 0;
  return files > 0 && (percent >= 100 || (total > 0 && files >= total));
}

export function statusForRelease(
  releaseGroupMbid: string | null,
  albums: Map<string, LidarrAlbum>
): LidarrReleaseStatus {
  const album = releaseGroupMbid
    ? albums.get(releaseGroupMbid.toLowerCase())
    : undefined;
  if (!album) return "not-tracked";

  if (hasAllTracks(album)) return "downloaded";
  if ((album.statistics?.trackFileCount ?? 0) > 0) return "partial";
  return album.monitored ? "monitored" : "unmonitored";
}

interface RequestedRelease {
  mbid: string;
  artistName: string;
  title: string;
  releaseDate: Date;
}

interface AlbumSearchCommand {
  name: string;
  status: string;
  body?: { albumIds?: number[] };
}

const pendingReleaseSearches = new Map<string, Promise<string>>();

async function monitorAndSearchRelease(
  release: RequestedRelease
): Promise<string> {
  const mbid = release.mbid.toLowerCase();
  const albums = (await lidarrRequest(
    `api/v1/album?foreignAlbumId=${encodeURIComponent(mbid)}`
  )) as LidarrAlbum[];
  const existing = albums.find(
    (album) => album.foreignAlbumId?.toLowerCase() === mbid
  );
  if (existing && hasAllTracks(existing)) {
    return "Already imported in Lidarr";
  }

  const album =
    existing ?? (await addShelfAlbum(mbid, release.artistName, release.title));
  if (existing && !existing.monitored) await monitorShelfAlbum(existing);
  if (release.releaseDate.getTime() > Date.now()) {
    return "Monitored in Lidarr for release day";
  }
  const albumId = album.id;
  if (!albumId)
    throw new LidarrReleaseActionError(
      "Lidarr did not return an album ID",
      502
    );

  try {
    const commands = (await lidarrRequest(
      "api/v1/command"
    )) as AlbumSearchCommand[];
    if (
      commands.some(
        (command) =>
          command.name === "AlbumSearch" &&
          (command.status === "queued" || command.status === "started") &&
          command.body?.albumIds?.includes(albumId)
      )
    ) {
      return "An album search is already queued or running";
    }
    await lidarrRequest("api/v1/command", "POST", {
      name: "AlbumSearch",
      albumIds: [albumId],
    });
  } catch {
    throw new LidarrReleaseActionError(
      "Monitored in Lidarr. The search could not be verified. Try again.",
      502
    );
  }
  return "Monitored in Lidarr. Album search queued";
}

export async function requestReleaseSearch(
  release: RequestedRelease
): Promise<string> {
  const key = release.mbid.toLowerCase();
  const running = pendingReleaseSearches.get(key);
  if (running) return running;

  const request = monitorAndSearchRelease(release);
  pendingReleaseSearches.set(key, request);
  try {
    return await request;
  } finally {
    pendingReleaseSearches.delete(key);
  }
}

async function fetchAlbums(): Promise<Map<string, LidarrAlbum> | null> {
  const baseUrl = process.env.LIDARR_URL || LIDARR_WEB_URL;
  const apiKey = process.env.LIDARR_API_KEY;
  if (!apiKey) return null;

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
