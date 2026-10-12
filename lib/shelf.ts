import { createHash } from "node:crypto";

export function shelfFingerprint(
  kind: "track" | "release",
  artist: string,
  title: string,
  album: string | null,
  mbid: string | null
): string {
  const identity =
    kind === "release" && mbid
      ? [kind, mbid.toLowerCase()]
      : [kind, artist, title, album ?? ""].map((part) =>
          part.trim().toLocaleLowerCase()
        );
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function sameName(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return Boolean(
    a && b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
  );
}
