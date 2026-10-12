import { describe, expect, it } from "vitest";
import { defaultPreferences, parsePreferences } from "./useDisplayPreferences";

describe("display preferences", () => {
  it("uses defaults for missing or invalid saved settings", () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences);
    expect(parsePreferences("not json")).toEqual(defaultPreferences);
  });
  it("restores saved values and rejects unsupported choices", () => {
    const settings = parsePreferences(
      JSON.stringify({
        clock: false,
        idleTimeout: 30,
        layout: "portrait",
        artworkSize: "huge",
      })
    );
    expect(settings.clock).toBe(false);
    expect(settings.idleTimeout).toBe(30);
    expect(settings.layout).toBe("portrait");
    expect(settings.artworkSize).toBe("normal");
  });
});
