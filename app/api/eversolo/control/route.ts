import { NextResponse } from "next/server";
import { clients } from "@/lib/clients";
import { nowPlayingPipeline } from "@/lib/poller/pipeline";

const CONTROL_ACTIONS = ["playOrPause", "playNext", "playLast"] as const;
type Action = (typeof CONTROL_ACTIONS)[number];

export async function POST(request: Request) {
  // Encore is private to the home network. Reject cross-site browser posts so
  // another website cannot send commands through a visitor's browser.
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  let originHost = "";
  try {
    if (origin) originHost = new URL(origin).host;
  } catch {
    /* reject malformed origin */
  }
  if (origin && originHost !== host) {
    return NextResponse.json(
      { error: "cross-origin request" },
      { status: 403 }
    );
  }

  let action: Action;
  try {
    ({ action } = (await request.json()) as { action: Action });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!(CONTROL_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  try {
    await clients.eversolo.control(action);
    nowPlayingPipeline.triggerPoll();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "player unavailable" }, { status: 503 });
  }
}
