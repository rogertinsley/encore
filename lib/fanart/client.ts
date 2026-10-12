export interface ArtistImages {
  background: string | null;
  thumbnail: string | null;
  logo: string | null;
}

const BASE_URL = "https://webservice.fanart.tv/v3/music";

export class FanartTVClient {
  constructor(private readonly apiKey: string) {}

  async getArtistImages(mbid: string): Promise<ArtistImages | null> {
    const response = await fetch(`${BASE_URL}/${mbid}?api_key=${this.apiKey}`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      artistbackground?: Array<{ url: string }>;
      artistthumb?: Array<{ url: string }>;
      musiclogo?: Array<{ url: string }>;
    };

    return {
      background: data.artistbackground?.[0]?.url ?? null,
      thumbnail: data.artistthumb?.[0]?.url ?? null,
      logo: data.musiclogo?.[0]?.url ?? null,
    };
  }
}
