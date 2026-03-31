export type {
  NowPlayingTrack,
  TopArtist,
  TopTag,
  SimilarArtist,
  ArtistInfo,
  AlbumInfo,
  TopTrack,
  TopAlbum,
  RecentTrack,
  UserTopTrack,
  UserTopAlbum,
  UserInfo,
  Period,
} from "./types";
import type {
  NowPlayingTrack,
  TopArtist,
  TopTag,
  SimilarArtist,
  ArtistInfo,
  AlbumInfo,
  TopTrack,
  TopAlbum,
  RecentTrack,
  UserTopTrack,
  UserTopAlbum,
  UserInfo,
  Period,
} from "./types";

const BASE_URL = "https://ws.audioscrobbler.com/2.0";

export class LastFMClient {
  constructor(private readonly apiKey: string) {}

  private async fetch<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Last.FM API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getAlbumInfo(artist: string, album: string): Promise<AlbumInfo | null> {
    const data = await this.fetch<{
      error?: number;
      album?: { name: string; artist: string; mbid: string };
    }>({ method: "album.getInfo", artist, album });

    if (data.error || !data.album) return null;

    const a = data.album;
    return {
      name: a.name,
      artist: a.artist,
      mbid: a.mbid || null,
    };
  }

  async getArtistInfo(
    artistName: string,
    username?: string
  ): Promise<ArtistInfo | null> {
    const params: Record<string, string> = {
      method: "artist.getInfo",
      artist: artistName,
    };
    if (username) params.username = username;

    const data = await this.fetch<{
      error?: number;
      artist?: {
        name: string;
        mbid: string;
        stats: { listeners: string; userplaycount?: string };
        bio: { summary: string };
        tags: { tag: Array<{ name: string }> };
      };
    }>(params);

    if (data.error || !data.artist) return null;

    const a = data.artist;
    return {
      name: a.name,
      mbid: a.mbid || null,
      bio: a.bio.summary || null,
      tags: a.tags.tag.map((t) => t.name),
      listeners: parseInt(a.stats.listeners, 10),
      userPlayCount: a.stats.userplaycount
        ? parseInt(a.stats.userplaycount, 10)
        : undefined,
    };
  }

  async getTopTracks(artistName: string, limit = 10): Promise<TopTrack[]> {
    const data = await this.fetch<{
      toptracks: {
        track: Array<{
          name: string;
          playcount: string;
          "@attr": { rank: string };
        }>;
      };
    }>({
      method: "artist.getTopTracks",
      artist: artistName,
      limit: String(limit),
    });

    return data.toptracks.track.map((t) => ({
      name: t.name,
      playCount: parseInt(t.playcount, 10),
      rank: parseInt(t["@attr"].rank, 10),
    }));
  }

  async getTopAlbums(artistName: string, limit = 6): Promise<TopAlbum[]> {
    const data = await this.fetch<{
      topalbums: {
        album: Array<{
          name: string;
          mbid?: string;
          image?: Array<{ "#text": string; size: string }>;
          "@attr": { rank: string };
        }>;
      };
    }>({
      method: "artist.getTopAlbums",
      artist: artistName,
      limit: String(limit),
    });

    const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

    return data.topalbums.album.map((a) => {
      const img =
        a.image?.find((i) => i.size === "extralarge") ??
        a.image?.find((i) => i.size === "large");
      const imageUrl =
        img?.["#text"] && !img["#text"].includes(LASTFM_PLACEHOLDER)
          ? img["#text"]
          : null;
      return {
        name: a.name,
        mbid: a.mbid || null,
        rank: parseInt(a["@attr"].rank, 10),
        imageUrl,
      };
    });
  }

  async getSimilarArtists(artistName: string): Promise<SimilarArtist[]> {
    const data = await this.fetch<{
      similarartists: { artist: Array<{ name: string; match: string }> };
    }>({ method: "artist.getSimilar", artist: artistName });

    return data.similarartists.artist.map((a) => ({
      name: a.name,
      match: parseFloat(a.match),
    }));
  }

  async getTopTags(username: string): Promise<TopTag[]> {
    const data = await this.fetch<{
      toptags: { tag: Array<{ name: string; count: string }> };
    }>({ method: "user.getTopTags", user: username });

    return data.toptags.tag.map((t) => ({
      name: t.name,
      count: parseInt(t.count, 10),
    }));
  }

  async getTopArtists(username: string, period: Period): Promise<TopArtist[]> {
    const data = await this.fetch<{
      topartists: {
        artist: Array<{
          name: string;
          playcount: string;
          "@attr": { rank: string };
        }>;
      };
    }>({ method: "user.getTopArtists", user: username, period });

    return data.topartists.artist.map((a) => ({
      name: a.name,
      playCount: parseInt(a.playcount, 10),
      rank: parseInt(a["@attr"].rank, 10),
    }));
  }

  async getRecentTracks(username: string, limit = 15): Promise<RecentTrack[]> {
    const data = await this.fetch<{
      recenttracks: {
        track: Array<{
          "@attr"?: { nowplaying?: string };
          name: string;
          artist: { "#text": string };
          album: { "#text": string };
          image: Array<{ "#text": string; size: string }>;
          date?: { uts: string };
        }>;
      };
    }>({
      method: "user.getRecentTracks",
      user: username,
      limit: String(limit),
    });

    return data.recenttracks.track
      .filter((t) => !t["@attr"]?.nowplaying && t.date)
      .map((t) => {
        const img =
          t.image.find((i) => i.size === "extralarge") ??
          t.image.find((i) => i.size === "large");
        return {
          trackName: t.name,
          artistName: t.artist["#text"],
          albumName: t.album["#text"] || null,
          albumArtUrl: img?.["#text"] || null,
          scrobbledAt: new Date(parseInt(t.date!.uts, 10) * 1000),
        };
      });
  }

  async getUserTopTracks(
    username: string,
    period: Period,
    limit = 20
  ): Promise<UserTopTrack[]> {
    const data = await this.fetch<{
      toptracks: {
        track: Array<{
          name: string;
          playcount: string;
          artist: { name: string };
          "@attr": { rank: string };
        }>;
      };
    }>({
      method: "user.getTopTracks",
      user: username,
      period,
      limit: String(limit),
    });

    return data.toptracks.track.map((t) => ({
      name: t.name,
      artistName: t.artist.name,
      playCount: parseInt(t.playcount, 10),
      rank: parseInt(t["@attr"].rank, 10),
    }));
  }

  async getUserTopAlbums(
    username: string,
    period: Period,
    limit = 12
  ): Promise<UserTopAlbum[]> {
    const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
    const data = await this.fetch<{
      topalbums: {
        album: Array<{
          name: string;
          playcount: string;
          artist: { name: string };
          image: Array<{ "#text": string; size: string }>;
          "@attr": { rank: string };
        }>;
      };
    }>({
      method: "user.getTopAlbums",
      user: username,
      period,
      limit: String(limit),
    });

    return data.topalbums.album.map((a) => {
      const img =
        a.image?.find((i) => i.size === "extralarge") ??
        a.image?.find((i) => i.size === "large");
      const imageUrl =
        img?.["#text"] && !img["#text"].includes(PLACEHOLDER)
          ? img["#text"]
          : null;
      return {
        name: a.name,
        artistName: a.artist.name,
        playCount: parseInt(a.playcount, 10),
        rank: parseInt(a["@attr"].rank, 10),
        imageUrl,
      };
    });
  }

  async getUserInfo(username: string): Promise<UserInfo> {
    const data = await this.fetch<{
      user: { playcount: string; registered: { unixtime: string } };
    }>({ method: "user.getInfo", user: username });

    return {
      totalScrobbles: parseInt(data.user.playcount, 10),
      registeredAt: new Date(
        parseInt(data.user.registered.unixtime, 10) * 1000
      ),
    };
  }

  async getNowPlaying(username: string): Promise<NowPlayingTrack | null> {
    const data = await this.fetch<{
      recenttracks: {
        track: Array<{
          "@attr"?: { nowplaying?: string };
          name: string;
          artist: { "#text": string };
          album: { "#text": string; mbid: string };
        }>;
      };
    }>({ method: "user.getRecentTracks", user: username, limit: "1" });

    const track = data.recenttracks.track[0];
    if (!track?.["@attr"]?.nowplaying) return null;

    return {
      trackName: track.name,
      artistName: track.artist["#text"],
      albumName: track.album["#text"] || null,
      albumMbid: track.album.mbid || null,
    };
  }
}
