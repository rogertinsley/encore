export type Period =
  | "overall"
  | "7day"
  | "1month"
  | "3month"
  | "6month"
  | "12month";

export interface NowPlayingTrack {
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumMbid: string | null;
}

export interface TopArtist {
  name: string;
  playCount: number;
  rank: number;
}

export interface TopTag {
  name: string;
  count: number;
}

export interface SimilarArtist {
  name: string;
  match: number;
}

export interface ArtistInfo {
  name: string;
  mbid: string | null;
  bio: string | null;
  tags: string[];
  listeners: number;
  userPlayCount?: number;
}

export interface AlbumInfo {
  name: string;
  artist: string;
  mbid: string | null;
}

export interface TopTrack {
  name: string;
  playCount: number;
  rank: number;
}

export interface TopAlbum {
  name: string;
  mbid: string | null;
  rank: number;
  imageUrl: string | null;
}

export interface UserTopTrack {
  name: string;
  artistName: string;
  playCount: number;
  rank: number;
}

export interface UserTopAlbum {
  name: string;
  artistName: string;
  playCount: number;
  rank: number;
  imageUrl: string | null;
}

export interface UserInfo {
  totalScrobbles: number;
  registeredAt: Date;
}

export interface RecentTrack {
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumArtUrl: string | null;
  scrobbledAt: Date | null;
}
