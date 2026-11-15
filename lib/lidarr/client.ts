export const LIDARR_WEB_URL = "https://lidarr.rogertinsley.com";

function lidarrUrl(path: string): URL {
  const base = process.env.LIDARR_URL || LIDARR_WEB_URL;
  if (!process.env.LIDARR_API_KEY) throw new Error("Lidarr is not configured");
  const url = new URL(path, `${base.replace(/\/$/, "")}/`);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid Lidarr URL");
  return url;
}

export async function lidarrRequest(
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const response = await fetch(lidarrUrl(path), {
    method,
    headers: {
      "X-Api-Key": process.env.LIDARR_API_KEY!,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Lidarr returned ${response.status}`);
  return response.json();
}
