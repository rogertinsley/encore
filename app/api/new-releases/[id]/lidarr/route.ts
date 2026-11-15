import { NextResponse } from "next/server";
import {
  LidarrReleaseActionError,
  requestReleaseSearch,
} from "@/lib/lidarr/releases";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/request-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  try {
    const { id } = await params;
    const release = await prisma.newRelease.findUnique({
      where: { id },
      select: { mbid: true, artistName: true, title: true, releaseDate: true },
    });
    if (!release) {
      return NextResponse.json(
        { message: "This release has changed. Refresh and try again." },
        { status: 404 }
      );
    }
    if (!release.mbid) {
      return NextResponse.json(
        { message: "This release has no MusicBrainz ID" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      await requestReleaseSearch({ ...release, mbid: release.mbid })
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
