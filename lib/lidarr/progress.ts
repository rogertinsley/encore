import { readRedisSnapshot } from "@/lib/utils/redis-snapshot";
import {
  getLidarrAlbums,
  lidarrRequest,
  statusForRelease,
  type LidarrReleaseStatus,
} from "./releases";

export type ReleaseProgress =
  | LidarrReleaseStatus
  | "queued"
  | "downloading"
  | "import-failed";

interface QueueRecord {
  albumId?: number;
  status?: string;
  trackedDownloadState?: string;
}

const LIVE_PROGRESS = { freshFor: 10, retainFor: 120 };

interface SearchCommand {
  name: string;
  status: string;
  body?: { albumIds?: number[] };
}

export async function getReleaseProgress(albumsPromise = getLidarrAlbums()) {
  if (!process.env.LIDARR_API_KEY) return () => null;
  const [albums, queue, commands] = await Promise.all([
    albumsPromise,
    readRedisSnapshot("lidarr:queue:v1", LIVE_PROGRESS, async () => {
      const data = (await lidarrRequest(
        "api/v1/queue?page=1&pageSize=250"
      )) as { records?: QueueRecord[] };
      if (!Array.isArray(data.records)) throw new Error("Invalid Lidarr queue");
      return data.records.map(({ albumId, status, trackedDownloadState }) => ({
        albumId,
        status,
        trackedDownloadState,
      }));
    }).catch(() => [] as QueueRecord[]),
    readRedisSnapshot("lidarr:album-searches:v1", LIVE_PROGRESS, async () => {
      const data = await lidarrRequest("api/v1/command");
      if (!Array.isArray(data)) throw new Error("Invalid Lidarr command list");
      return (data as SearchCommand[])
        .filter(
          (command) =>
            command.name === "AlbumSearch" &&
            ["queued", "started"].includes(command.status)
        )
        .flatMap((command) => command.body?.albumIds ?? []);
    }).catch(() => [] as number[]),
  ]);
  return (mbid: string | null): ReleaseProgress | null => {
    if (!albums || !mbid) return null;
    const status = statusForRelease(mbid, albums);
    const id = albums.get(mbid.toLowerCase())?.id;
    if (!id || status === "downloaded") return status;

    const records = queue.filter((record) => record.albumId === id);
    if (
      records.some((record) => record.trackedDownloadState === "importFailed")
    ) {
      return "import-failed";
    }
    if (records.some((record) => record.status === "downloading"))
      return "downloading";
    if (records.length || commands.includes(id)) return "queued";
    return status;
  };
}
