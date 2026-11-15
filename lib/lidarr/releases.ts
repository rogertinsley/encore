/** MusicBrainz release-group status and explicit Lidarr album actions. */
import { sameName } from "@/lib/shelf";
import { lidarrRequest } from "./client";
import {
  invalidateRedisSnapshot,
  readRedisSnapshot,
} from "@/lib/utils/redis-snapshot";
import { ensureReleaseArtist } from "./artists";

export { LIDARR_WEB_URL, lidarrRequest } from "./client";

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
  await invalidateRedisSnapshot(ALBUMS_KEY);
}

export async function addShelfAlbum(
  releaseGroupMbid: string,
  artistName: string,
  albumName: string,
  addMissingArtist = false
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
  let artist = Array.isArray(artists)
    ? artists.find(
        (value) =>
          value &&
          typeof value === "object" &&
          sameName(value.artistName, artistName) &&
          (!match.artist?.foreignArtistId ||
            value.foreignArtistId === match.artist.foreignArtistId)
      )
    : null;
  if (!artist?.id && addMissingArtist && match.artist?.foreignArtistId) {
    artist = await ensureReleaseArtist(match.artist.foreignArtistId);
    // Lidarr may create album records when it registers an artist.
    const registeredAlbums = (await lidarrRequest(
      `api/v1/album?foreignAlbumId=${encodeURIComponent(releaseGroupMbid)}`
    )) as LidarrAlbum[];
    const registered = registeredAlbums.find(
      (album) =>
        album.foreignAlbumId?.toLowerCase() === releaseGroupMbid.toLowerCase()
    );
    if (registered) {
      if (!registered.monitored) await monitorShelfAlbum(registered);
      return registered;
    }
  }
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
  await invalidateRedisSnapshot(ALBUMS_KEY);
  return added;
}

const ALBUMS_KEY = "lidarr:albums:v1";

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
    existing ??
    (await addShelfAlbum(mbid, release.artistName, release.title, true));
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

async function fetchAlbums(): Promise<LidarrAlbum[]> {
  const data = await lidarrRequest("api/v1/album");
  if (!Array.isArray(data)) throw new Error("Unexpected Lidarr album list");
  return (data as LidarrAlbum[])
    .filter((album) => typeof album?.foreignAlbumId === "string")
    .map(({ id, title, artist, foreignAlbumId, monitored, statistics }) => ({
      id,
      title,
      artist: artist && {
        artistName: artist.artistName,
        foreignArtistId: artist.foreignArtistId,
      },
      foreignAlbumId,
      monitored,
      statistics,
    }));
}

export async function getLidarrAlbums(
  fresh = false
): Promise<Map<string, LidarrAlbum> | null> {
  if (!process.env.LIDARR_API_KEY) return null;
  try {
    const albums = fresh
      ? await fetchAlbums()
      : await readRedisSnapshot(
          ALBUMS_KEY,
          { freshFor: 15, retainFor: 1800 },
          fetchAlbums
        );
    return new Map(
      albums.map((album) => [album.foreignAlbumId!.toLowerCase(), album])
    );
  } catch (error) {
    console.warn("[Lidarr] Could not load album status", error);
    return null;
  }
}
