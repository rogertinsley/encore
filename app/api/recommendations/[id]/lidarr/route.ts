import { NextResponse } from "next/server";
import { requestArtistSearch } from "@/lib/lidarr/artists";
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

  let onlyIfNew = false;
  try {
    const raw = await request.text();
    if (raw) {
      const body = JSON.parse(raw);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        ("onlyIfNew" in body && typeof body.onlyIfNew !== "boolean")
      ) {
        throw new Error("Invalid onlyIfNew option");
      }
      onlyIfNew = body.onlyIfNew ?? false;
    }
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: { artistName: true },
    });
    if (!recommendation) {
      return NextResponse.json(
        { message: "This recommendation has changed. Refresh and try again." },
        { status: 404 }
      );
    }
    const { ok, ...result } = await requestArtistSearch(
      recommendation.artistName,
      onlyIfNew
    );
    return NextResponse.json(result, { status: ok ? 200 : 409 });
  } catch {
    return NextResponse.json(
      { message: "Lidarr request failed. Please try again." },
      { status: 502 }
    );
  }
}
