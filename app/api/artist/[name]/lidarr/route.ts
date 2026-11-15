import { NextResponse } from "next/server";
import { requestArtistAdd } from "@/lib/lidarr/artists";
import { isSameOrigin } from "@/lib/request-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
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

  const { name } = await params;
  const artistName = name.trim();
  if (!artistName) {
    return NextResponse.json(
      { message: "Enter an artist name" },
      { status: 400 }
    );
  }

  try {
    const { ok, message } = await requestArtistAdd(artistName);
    return NextResponse.json({ message }, { status: ok ? 200 : 409 });
  } catch {
    return NextResponse.json(
      { message: "Could not add the artist in Lidarr. Try again." },
      { status: 502 }
    );
  }
}
