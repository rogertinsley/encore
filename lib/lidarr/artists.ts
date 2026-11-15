import { sameName } from "@/lib/shelf";
import { lidarrRequest } from "./client";

interface LidarrArtist {
  id: number;
  artistName: string;
  foreignArtistId: string;
}

interface RootFolder {
  path: string;
  defaultQualityProfileId: number;
  defaultMetadataProfileId: number;
}

interface ArtistSearchResult {
  ok: boolean;
  message: string;
  added?: boolean;
}

const pending = new Map<
  string,
  { onlyIfNew: boolean; request: Promise<ArtistSearchResult> }
>();

async function registerArtist(
  match: LidarrArtist,
  monitor: "all" | "none"
): Promise<LidarrArtist | null> {
  const folders = (await lidarrRequest("api/v1/rootfolder")) as RootFolder[];
  if (folders.length !== 1) return null;
  const [folder] = folders;
  return (await lidarrRequest("api/v1/artist", "POST", {
    ...match,
    id: 0,
    path: "",
    rootFolderPath: folder.path,
    qualityProfileId: folder.defaultQualityProfileId,
    metadataProfileId: folder.defaultMetadataProfileId,
    monitored: true,
    monitorNewItems: monitor,
    addOptions: { monitor, searchForMissingAlbums: monitor === "all" },
  })) as LidarrArtist;
}

type Registration = { artist: LidarrArtist | null; added: boolean };
const pendingRegistrations = new Map<string, Promise<Registration>>();

async function registerOnce(
  match: LidarrArtist,
  monitor: "all" | "none"
): Promise<Registration> {
  const key = match.foreignArtistId;
  const running = pendingRegistrations.get(key);
  if (running) {
    const result = await running;
    return { artist: result.artist, added: false };
  }
  const request = (async () => {
    const artists = (await lidarrRequest("api/v1/artist")) as LidarrArtist[];
    const existing = artists.find((artist) => artist.foreignArtistId === key);
    if (existing) return { artist: existing, added: false };
    const artist = await registerArtist(match, monitor);
    return { artist, added: Boolean(artist) };
  })();
  pendingRegistrations.set(key, request);
  try {
    return await request;
  } finally {
    pendingRegistrations.delete(key);
  }
}

export async function getLidarrArtistStatus(
  artistName: string,
  mbid: string | null
): Promise<boolean | null> {
  if (!process.env.LIDARR_API_KEY) return null;
  try {
    const artists = (await lidarrRequest("api/v1/artist")) as LidarrArtist[];
    return mbid
      ? artists.some(
          (artist) =>
            artist.foreignArtistId?.toLowerCase() === mbid.toLowerCase()
        )
      : artists.filter((artist) => sameName(artist.artistName, artistName))
          .length === 1;
  } catch {
    return null;
  }
}

export async function ensureReleaseArtist(mbid: string) {
  const candidates = (await lidarrRequest(
    `api/v1/artist/lookup?term=lidarr:${encodeURIComponent(mbid)}`
  )) as LidarrArtist[];
  const match = candidates.find((artist) => artist.foreignArtistId === mbid);
  return match ? (await registerOnce(match, "none")).artist : null;
}

async function applyArtistRequest(
  artistName: string,
  mode: "add" | "search" | "discover"
): Promise<ArtistSearchResult> {
  const term = encodeURIComponent(artistName);
  const matches = (
    (await lidarrRequest(`api/v1/artist/lookup?term=${term}`)) as LidarrArtist[]
  ).filter(
    (artist) =>
      artist.foreignArtistId && sameName(artist.artistName, artistName)
  );

  if (matches.length !== 1) {
    return {
      ok: false,
      message: matches.length
        ? "Multiple artists match. Choose the artist in Lidarr."
        : "No exact match in Lidarr. Search for the artist there.",
    };
  }

  const [match] = matches;
  const registration = await registerOnce(
    match,
    mode === "add" ? "none" : "all"
  );
  const existing = registration.added ? null : registration.artist;

  if (existing) {
    if (mode !== "search") {
      return { ok: true, added: false, message: "Artist already in Lidarr" };
    }
    await lidarrRequest("api/v1/command", "POST", {
      name: "MissingAlbumSearch",
      artistId: existing.id,
    });
    return {
      ok: true,
      added: false,
      message: "Search queued for missing monitored albums",
    };
  }

  if (!registration.artist) {
    return {
      ok: false,
      message: "Add the artist in Lidarr to choose a music folder.",
    };
  }
  return {
    ok: true,
    added: true,
    message:
      mode === "add"
        ? "Artist added to Lidarr"
        : "Artist added and album search requested",
  };
}

export function requestArtistAdd(
  artistName: string
): Promise<ArtistSearchResult> {
  return applyArtistRequest(artistName, "add");
}

export async function requestArtistSearch(
  artistName: string,
  onlyIfNew = false
): Promise<ArtistSearchResult> {
  const key = artistName.trim().toLowerCase();
  const running = pending.get(key);
  if (running) {
    if (running.onlyIfNew === onlyIfNew) return running.request;
    await running.request.catch(() => undefined);
    return requestArtistSearch(artistName, onlyIfNew);
  }

  const request = applyArtistRequest(
    artistName,
    onlyIfNew ? "discover" : "search"
  );
  pending.set(key, { onlyIfNew, request });
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}

export async function addArtistAndSearch(artistName: string): Promise<string> {
  return (await requestArtistSearch(artistName)).message;
}
