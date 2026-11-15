import { sameName } from "@/lib/shelf";
import { lidarrRequest } from "./releases";

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

async function addAndSearch(
  artistName: string,
  onlyIfNew: boolean
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
  const artists = (await lidarrRequest("api/v1/artist")) as LidarrArtist[];
  const existing = artists.find(
    (artist) => artist.foreignArtistId === match.foreignArtistId
  );

  if (existing) {
    if (onlyIfNew) {
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

  const folders = (await lidarrRequest("api/v1/rootfolder")) as RootFolder[];
  if (folders.length !== 1) {
    return {
      ok: false,
      message: "Add the artist in Lidarr to choose a music folder.",
    };
  }
  const [folder] = folders;
  await lidarrRequest("api/v1/artist", "POST", {
    ...match,
    id: 0,
    path: "",
    rootFolderPath: folder.path,
    qualityProfileId: folder.defaultQualityProfileId,
    metadataProfileId: folder.defaultMetadataProfileId,
    monitored: true,
    monitorNewItems: "all",
    addOptions: { monitor: "all", searchForMissingAlbums: true },
  });
  return {
    ok: true,
    added: true,
    message: "Artist added and album search requested",
  };
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

  const request = addAndSearch(artistName, onlyIfNew);
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
