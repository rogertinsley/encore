export type PlaybackAction = "playLast" | "playOrPause" | "playNext";

export async function sendPlaybackControl(
  action: PlaybackAction
): Promise<void> {
  const response = await fetch("/api/eversolo/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok)
    throw new Error(`Player command failed: ${response.status}`);
}
