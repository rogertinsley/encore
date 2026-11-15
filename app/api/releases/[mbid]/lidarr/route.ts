import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import {
  LidarrReleaseActionError,
  requestReleaseSearch,
} from "@/lib/lidarr/releases";
import { MusicBrainzResponseError } from "@/lib/musicbrainz/client";
import { isSameOrigin } from "@/lib/request-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  if (!request.headers.has("origin") || !isSameOrigin(request)) {
    return NextResponse.json(
      { message: "Cross-origin request" },
      { status: 403 }
    );
  }
  if (!process.env.LIDARR_API_KEY) {
    return NextResponse.json(
      { message: "Lidarr is not configured" },
      { status: 503 }
    );
  }
  const { mbid } = await params;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(mbid)) {
    return NextResponse.json(
      { message: "Invalid release ID" },
      { status: 400 }
    );
  }

  const release = await clients.musicBrainz
    .lookupCatalogRelease(mbid)
    .catch((error: unknown) => {
      if (error instanceof MusicBrainzResponseError && error.status === 404)
        return null;
      return undefined;
    });
  if (release === undefined) {
    return NextResponse.json(
      { message: "MusicBrainz is unavailable. Try the search again shortly." },
      { status: 502 }
    );
  }
  try {
    if (!release?.mbid || !release.artistName || !release.title) {
      return NextResponse.json(
        { message: "Could not verify this release" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      await requestReleaseSearch({
        ...release,
        releaseDate: new Date(release.releaseDate ?? 0),
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof LidarrReleaseActionError
            ? error.message
            : "Lidarr request failed. Please try again.",
      },
      { status: error instanceof LidarrReleaseActionError ? error.status : 502 }
    );
  }
}
