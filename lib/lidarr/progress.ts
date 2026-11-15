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

async function readProgress() {
  const [albums, queue, commands] = await Promise.all([
    getLidarrAlbums(),
    lidarrRequest("api/v1/queue?page=1&pageSize=250").catch(
      () => null
    ) as Promise<{ records?: QueueRecord[] } | null>,
    lidarrRequest("api/v1/command").catch(() => null) as Promise<Array<{
      name: string;
      status: string;
      body?: { albumIds?: number[] };
    }> | null>,
  ]);
  return (mbid: string | null): ReleaseProgress | null => {
    if (!albums || !mbid) return null;
    const status = statusForRelease(mbid, albums);
    const id = albums.get(mbid.toLowerCase())?.id;
    if (!id || status === "downloaded") return status;

    const records =
      queue?.records?.filter((record) => record.albumId === id) ?? [];
    if (
      records.some((record) => record.trackedDownloadState === "importFailed")
    ) {
      return "import-failed";
    }
    if (records.some((record) => record.status === "downloading"))
      return "downloading";
    if (
      records.length ||
      commands?.some(
        (command) =>
          command.name === "AlbumSearch" &&
          ["queued", "started"].includes(command.status) &&
          command.body?.albumIds?.includes(id)
      )
    )
      return "queued";
    return status;
  };
}

let snapshot: Awaited<ReturnType<typeof readProgress>> | undefined;
let expiresAt = 0;
let pending: ReturnType<typeof readProgress> | undefined;

export async function getReleaseProgress() {
  if (!process.env.LIDARR_API_KEY) return () => null;
  if (snapshot && Date.now() < expiresAt) return snapshot;
  pending ??= readProgress()
    .then((result) => {
      snapshot = result;
      expiresAt = Date.now() + 10_000;
      return result;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
