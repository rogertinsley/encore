const BASE_URL = "https://coverartarchive.org";

export class CoverArtArchiveClient {
  private async fetchFrontArt(path: string): Promise<string | null> {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      images: Array<{ front: boolean; image: string }>;
    };
    return data.images.find((img) => img.front)?.image ?? null;
  }

  async getAlbumArt(releaseMbid: string): Promise<string | null> {
    return this.fetchFrontArt(`/release/${releaseMbid}`);
  }

  async getAlbumArtByReleaseGroup(
    releaseGroupMbid: string
  ): Promise<string | null> {
    return this.fetchFrontArt(`/release-group/${releaseGroupMbid}`);
  }
}
