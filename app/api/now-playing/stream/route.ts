import { redis } from "@/lib/redis";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";

export const dynamic = "force-dynamic";

const POLL_MS = 500;

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let heartbeatId: ReturnType<typeof setInterval> | undefined;
  let lastJson = "";

  const stream = new ReadableStream({
    start(controller) {
      const send = (json: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${json}\n\n`));
        } catch {
          // client disconnected
        }
      };

      const poll = async () => {
        try {
          const raw = await redis.get(NOW_PLAYING_KEY);
          const json = raw ?? "null";
          if (json !== lastJson) {
            lastJson = json;
            send(json);
          }
        } catch {
          // ignore redis errors, client will reconnect via EventSource
        }
      };

      void poll();
      intervalId = setInterval(poll, POLL_MS);
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          /* disconnected */
        }
      }, 15_000);
    },
    cancel() {
      clearInterval(intervalId);
      clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
