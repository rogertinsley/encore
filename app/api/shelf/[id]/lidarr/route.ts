import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addShelfAlbum,
  findShelfAlbum,
  getLidarrAlbums,
  monitorShelfAlbum,
} from "@/lib/lidarr/releases";
import { isSameOrigin } from "@/lib/request-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "cross-origin request" },
      { status: 403 }
    );
  let action: string;
  try {
    ({ action } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (action !== "monitor" && action !== "add")
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  const { id } = await params;
  const item = await prisma.listeningShelfItem.findUnique({ where: { id } });
  if (!item)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const albums = await getLidarrAlbums();
  if (!albums)
    return NextResponse.json({ error: "Lidarr unavailable" }, { status: 503 });
  const album = findShelfAlbum(albums, item);
  try {
    if (action === "monitor" && album) await monitorShelfAlbum(album);
    else if (
      action === "add" &&
      !album &&
      item.releaseGroupMbid &&
      item.albumName
    )
      await addShelfAlbum(
        item.releaseGroupMbid,
        item.artistName,
        item.albumName
      );
    else
      return NextResponse.json(
        { error: "Album action unavailable" },
        { status: 409 }
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lidarr command failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
