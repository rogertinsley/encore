import type { LastFMClient, TopArtist } from "@/lib/lastfm/client";
import type { MusicBrainzClient, Release } from "@/lib/musicbrainz/client";

export interface NewRelease {
  artistName: string;
  title: string;
  date: string;
  type: string;
  playCount: number;
  mbid: string;
}

type LastFMDep = Pick<LastFMClient, "getTopArtists">;
type MusicBrainzDep = Pick<
  MusicBrainzClient,
  "searchArtist" | "getRecentReleases"
>;

export class NewReleasesService {
  constructor(
    private readonly lastfm: LastFMDep,
    private readonly musicBrainz: MusicBrainzDep
  ) {}

  async getNewReleases(username: string, since: Date): Promise<NewRelease[]> {
    const topArtists = await this.lastfm.getTopArtists(username, "overall");

    const settled = await Promise.allSettled(
      topArtists.map((artist) => this.releasesForArtist(artist, since))
    );

    const seen = new Set<string>();
    const releases: NewRelease[] = [];

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      for (const release of result.value) {
        if (seen.has(release.mbid)) continue;
        seen.add(release.mbid);
        releases.push(release);
      }
    }

    return releases.sort((a, b) => b.playCount - a.playCount);
  }

  private async releasesForArtist(
    artist: TopArtist,
    since: Date
  ): Promise<NewRelease[]> {
    const mbid = await this.musicBrainz.searchArtist(artist.name);
    if (!mbid) return [];

    const releases = await this.musicBrainz.getRecentReleases(mbid, since);
    console.log(`[NewReleases] ${artist.name}: ${releases.length} release(s)`);
    return releases.map((r: Release) => ({
      artistName: artist.name,
      title: r.title,
      date: r.date,
      type: r.type,
      playCount: artist.playCount,
      mbid: r.mbid,
    }));
  }
}
