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

const pending = new Map<string, Promise<string>>();

async function addAndSearch(artistName: string): Promise<string> {
  const term = encodeURIComponent(artistName);
  const matches = (
    (await lidarrRequest(`api/v1/artist/lookup?term=${term}`)) as LidarrArtist[]
  ).filter(
    (artist) =>
      artist.foreignArtistId && sameName(artist.artistName, artistName)
  );

  if (matches.length !== 1) {
    return matches.length
      ? "Multiple artists match. Choose the artist in Lidarr."
      : "No exact match in Lidarr. Search for the artist there.";
  }

  const [match] = matches;
  const artists = (await lidarrRequest("api/v1/artist")) as LidarrArtist[];
  const existing = artists.find(
    (artist) => artist.foreignArtistId === match.foreignArtistId
  );

  if (existing) {
    await lidarrRequest("api/v1/command", "POST", {
      name: "MissingAlbumSearch",
      artistId: existing.id,
    });
    return "Search queued for missing monitored albums";
  }

  const folders = (await lidarrRequest("api/v1/rootfolder")) as RootFolder[];
  if (folders.length !== 1) {
    return "Add the artist in Lidarr to choose a music folder.";
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
  return "Artist added and album search requested";
}

export async function addArtistAndSearch(artistName: string): Promise<string> {
  const key = artistName.trim().toLowerCase();
  const running = pending.get(key);
  if (running) return running;

  const request = addAndSearch(artistName);
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
