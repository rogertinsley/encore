import { redis } from "@/lib/redis";
import { NOW_PLAYING_KEY } from "@/lib/poller/now-playing";

export const dynamic = "force-dynamic";

const POLL_MS = 500;

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let heartbeatId: ReturnType<typeof setInterval> | undefined;
  let lastJson = "";
  let closed = false;
  let polling = false;
  const cleanup = () => {
    closed = true;
    clearInterval(intervalId);
    clearInterval(heartbeatId);
  };

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
        if (closed || polling) return;
        polling = true;
        try {
          const raw = await redis.get(NOW_PLAYING_KEY);
          if (closed) return;
          const json = raw ?? "null";
          if (json !== lastJson) {
            lastJson = json;
            send(json);
          }
        } catch (err) {
          if (closed) return;
          cleanup();
          // End the stream so EventSource marks the connection as lost and
          // retries. Heartbeats alone would leave stale tracks looking live.
          controller.error(err);
        } finally {
          polling = false;
        }
      };

      void poll();
      intervalId = setInterval(poll, POLL_MS);
      heartbeatId = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          /* disconnected */
        }
      }, 15_000);
    },
    cancel() {
      cleanup();
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
