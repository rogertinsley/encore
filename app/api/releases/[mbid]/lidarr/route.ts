import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import {
  LidarrReleaseActionError,
  requestReleaseSearch,
} from "@/lib/lidarr/releases";
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

  try {
    const release = await clients.musicBrainz.lookupCatalogRelease(mbid);
    if (!release.artistName || !release.title) {
      return NextResponse.json(
        { message: "Could not verify this release" },
        { status: 409 }
      );
    }
    return NextResponse.json({
      message: await requestReleaseSearch({
        ...release,
        releaseDate: new Date(release.releaseDate ?? 0),
      }),
    });
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
