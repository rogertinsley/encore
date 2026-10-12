import { describe, expect, it } from "vitest";
import {
  findShelfAlbum,
  statusForRelease,
  type LidarrAlbum,
} from "./lidarr/releases";
import { isSameOrigin } from "./request-origin";

describe("Shelf Lidarr matching", () => {
  const album: LidarrAlbum = {
    id: 17,
    title: "In Rainbows",
    foreignAlbumId: "release-group-1",
    artist: { artistName: "Radiohead" },
    monitored: false,
  };
  const albums = new Map([["release-group-1", album]]);

  it("finds a Discover release by release-group ID", () => {
    expect(
      findShelfAlbum(albums, {
        releaseGroupMbid: "RELEASE-GROUP-1",
        artistName: "Radiohead",
        albumName: "In Rainbows",
      })
    ).toBe(album);
    expect(statusForRelease(album.foreignAlbumId!, albums)).toBe("unmonitored");
  });
  it("finds a saved radio track by exact artist and album", () => {
    expect(
      findShelfAlbum(albums, {
        releaseGroupMbid: null,
        artistName: "radiohead",
        albumName: "in rainbows",
      })
    ).toBe(album);
    expect(
      findShelfAlbum(albums, {
        releaseGroupMbid: null,
        artistName: "Other",
        albumName: "In Rainbows",
      })
    ).toBeUndefined();
  });
});

describe("Shelf write origin", () => {
  it("accepts its own host and rejects another site", () => {
    expect(
      isSameOrigin(
        new Request("https://encore.example/api/shelf", {
          headers: { host: "encore.example", origin: "https://encore.example" },
        })
      )
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request("https://encore.example/api/shelf", {
          headers: {
            host: "encore.example",
            origin: "https://elsewhere.example",
          },
        })
      )
    ).toBe(false);
  });
});
