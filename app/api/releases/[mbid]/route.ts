import { NextResponse } from "next/server";
import { getReleaseProgress } from "@/lib/lidarr/progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  const progress = await getReleaseProgress();
  return NextResponse.json({ status: progress(mbid) });
}
