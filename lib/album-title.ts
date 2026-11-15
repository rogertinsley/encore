export function baseAlbumTitle(title: string): string {
  return title
    .trim()
    .replace(/\s*\((?:\d{4}\s+)?remaster(?:ed)?(?:\s+edition)?\)$/i, "");
}
