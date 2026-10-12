import { describe, expect, it } from "vitest";
import { shelfFingerprint, sameName } from "./shelf";

describe("Listening Shelf identity", () => {
  it("deduplicates equivalent track names", () => {
    expect(
      shelfFingerprint(
        "track",
        " Radiohead ",
        "Weird Fishes",
        "In Rainbows",
        null
      )
    ).toBe(
      shelfFingerprint(
        "track",
        "radiohead",
        "weird fishes",
        "in rainbows",
        null
      )
    );
  });
  it("keys releases by MusicBrainz ID", () => {
    expect(shelfFingerprint("release", "A", "Album", "Album", "ABCD")).toBe(
      shelfFingerprint("release", "B", "Other", "Other", "abcd")
    );
  });
  it("matches album names exactly, ignoring case and outer spaces", () => {
    expect(sameName(" In Rainbows ", "in rainbows")).toBe(true);
    expect(sameName("In Rainbows Live", "In Rainbows")).toBe(false);
  });
});
