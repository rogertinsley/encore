export interface Release {
  mbid: string;
  title: string;
  date: string;
  type: string;
}

const BASE_URL = "https://musicbrainz.org/ws/2";
const USER_AGENT = "MusicRecommender/1.0";

export class MusicBrainzClient {
  private lastRequestTime = 0;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(private readonly minRequestInterval = 1000) {}

  private throttle(): Promise<void> {
    const queued = this.requestQueue.then(async () => {
      const elapsed = Date.now() - this.lastRequestTime;
      const delay = this.minRequestInterval - elapsed;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      this.lastRequestTime = Date.now();
    });
    // Keep the chain alive even if a request fails
    this.requestQueue = queued.catch(() => {});
    return queued;
  }

  private async fetch<T>(
    path: string,
    params: Record<string, string>
  ): Promise<T> {
    await this.throttle();
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok)
      throw new Error(`MusicBrainz API error: ${response.status}`);
    return response.json() as Promise<T>;
  }

  async getRecentReleases(mbid: string, since: Date): Promise<Release[]> {
    const data = await this.fetch<{
      "release-groups": Array<{
        id: string;
        title: string;
        "first-release-date": string;
        "primary-type": string;
      }>;
    }>("/release-group", {
      artist: mbid,
      type: "album|single|ep",
      limit: "100",
    });

    return data["release-groups"]
      .filter((rg) => {
        const releaseDate = new Date(rg["first-release-date"]);
        return !isNaN(releaseDate.getTime()) && releaseDate >= since;
      })
      .map((rg) => ({
        mbid: rg.id,
        title: rg.title,
        date: rg["first-release-date"],
        type: rg["primary-type"],
      }));
  }

  async getReleaseGroupYear(mbid: string): Promise<number | null> {
    try {
      const data = await this.fetch<{ "first-release-date"?: string }>(
        `/release-group/${mbid}`,
        {}
      );
      const date = data["first-release-date"];
      if (!date) return null;
      const year = parseInt(date.slice(0, 4), 10);
      return isNaN(year) ? null : year;
    } catch {
      return null;
    }
  }

  async searchArtist(name: string): Promise<string | null> {
    const data = await this.fetch<{
      artists: Array<{ id: string; name: string; score: number }>;
    }>("/artist", { query: name });

    return data.artists[0]?.id ?? null;
  }

  async searchRelease(
    artistName: string,
    albumName: string
  ): Promise<string | null> {
    // MusicBrainz indexes by sort name which strips leading articles
    const sortName = artistName.replace(/^(the|a|an)\s+/i, "");
    const data = await this.fetch<{
      "release-groups": Array<{ id: string; score: number }>;
    }>("/release-group", {
      query: `artist:"${sortName}" AND releasegroup:"${albumName}"`,
    });

    return data["release-groups"][0]?.id ?? null;
  }
}
