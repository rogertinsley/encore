import { LASTFM_PLACEHOLDER } from "./constants";

/**
 * Returns null if the URL is the Last.FM placeholder image or absent;
 * otherwise returns the URL unchanged.
 */
export function filterPlaceholder(
  url: string | null | undefined
): string | null {
  if (!url || url.includes(LASTFM_PLACEHOLDER)) return null;
  return url;
}
