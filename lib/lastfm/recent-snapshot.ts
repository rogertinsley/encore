import { clients } from "@/lib/clients";
import { normalizeTrack } from "./transforms";
import { readRedisSnapshot } from "@/lib/utils/redis-snapshot";

export async function getRecentListening(limit: number) {
  const username = process.env.LASTFM_USERNAME ?? "";
  const tracks = await readRedisSnapshot(
    `lastfm:recent:v1:${username.toLowerCase()}`,
    { freshFor: 30, retainFor: 900 },
    async () =>
      (await clients.lastfm.getRecentTracks(username, 15)).map(normalizeTrack)
  );
  return tracks.slice(0, limit);
}
