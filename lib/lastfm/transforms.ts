import type { RecentTrack } from "./types";
import { filterPlaceholder } from "./utils";

export interface NormalizedTrack extends Omit<
  RecentTrack,
  "albumArtUrl" | "scrobbledAt"
> {
  albumArtUrl: string | null;
  scrobbledAt: string | null;
}

/** Serialize a RecentTrack for API responses: filter placeholder art, stringify date. */
export function normalizeTrack(t: RecentTrack): NormalizedTrack {
  return {
    ...t,
    albumArtUrl: filterPlaceholder(t.albumArtUrl),
    scrobbledAt: t.scrobbledAt?.toISOString() ?? null,
  };
}
