export interface Release {
  mbid: string;
  title: string;
  date: string;
  type: string;
}

interface ReleaseGroup {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "artist-credit"?: Array<{
    name: string;
    joinphrase?: string;
  }>;
}

function toCatalogRelease(group: ReleaseGroup) {
  return {
    mbid: group.id,
    title: group.title,
    releaseDate: group["first-release-date"] ?? null,
    releaseType: group["primary-type"] ?? null,
    artistName:
      group["artist-credit"]
        ?.map((credit) => credit.name + (credit.joinphrase ?? ""))
        .join("") ?? "",
  };
}

export class MusicBrainzResponseError extends Error {
  constructor(readonly status: number) {
    super(`MusicBrainz API error: ${status}`);
  }
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
    params: Record<string, string>,
    revalidate?: number
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const request = async () => {
      await this.throttle();
      return fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8_000),
        ...(revalidate ? { next: { revalidate } } : {}),
      });
    };
    let response = await request();
    if (revalidate && response.status === 503) {
      await response.body?.cancel();
      response = await request();
    }
    if (!response.ok) throw new MusicBrainzResponseError(response.status);
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

  async searchCatalog(query: string, type: "artist" | "album") {
    const phrase = query.replace(/[\\"]/g, "\\$&");
    if (type === "artist") {
      const data = await this.fetch<{
        artists: Array<{ id: string; name: string; disambiguation?: string }>;
      }>("/artist", { query: `artist:"${phrase}"`, limit: "12" }, 300);
      return {
        artists: data.artists.map(({ id, name, disambiguation }) => ({
          id,
          name,
          disambiguation,
        })),
        releases: [],
      };
    }
    const data = await this.fetch<{ "release-groups": ReleaseGroup[] }>(
      "/release-group",
      { query: `releasegroup:"${phrase}"`, limit: "12" },
      300
    );
    return {
      artists: [],
      releases: data["release-groups"].map(toCatalogRelease),
    };
  }

  async lookupCatalogRelease(mbid: string, preferEdition = false) {
    const lookupGroup = () =>
      this.fetch<ReleaseGroup>(
        `/release-group/${mbid}`,
        { inc: "artist-credits" },
        86400
      );
    const lookupEdition = async () => {
      const edition = await this.fetch<{
        "release-group": ReleaseGroup;
        "artist-credit"?: ReleaseGroup["artist-credit"];
      }>(`/release/${mbid}`, { inc: "release-groups+artist-credits" }, 86400);
      return {
        ...edition["release-group"],
        "artist-credit":
          edition["release-group"]?.["artist-credit"] ??
          edition["artist-credit"],
      };
    };
    const lookup = preferEdition ? lookupEdition : lookupGroup;
    const fallback = preferEdition ? lookupGroup : lookupEdition;
    const group = await lookup().catch((error: unknown) => {
      if (error instanceof MusicBrainzResponseError && error.status === 404)
        return fallback();
      throw error;
    });
    return toCatalogRelease(group);
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
