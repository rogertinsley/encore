const releaseWindow = 90 * 86400000;
const encore = "http://localhost:3567";
const artistLimit = 3;
const artistLookupLimit = 10;
const dryRun = process.argv.includes("--dry-run");
const normalize = (name) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "");

async function getJson(url, options) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    ...options,
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} at ${new URL(url).pathname}`);
  return response.json();
}

function lidarr(path, method = "GET", body) {
  const base = process.env.LIDARR_URL || "https://lidarr.rogertinsley.com";
  if (!process.env.LIDARR_API_KEY) throw new Error("LIDARR_API_KEY is missing");
  return getJson(new URL(`api/v1/${path}`, base.replace(/\/?$/, "/")), {
    method,
    headers: {
      "X-Api-Key": process.env.LIDARR_API_KEY,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
}

const run = {
  startedAt: new Date().toISOString(),
  added: [],
  addedArtists: [],
  searched: [],
  issues: [],
};

async function syncReleases() {
  const [{ releases }, artists, albums] = await Promise.all([
    getJson(encore + "/api/new-releases"),
    lidarr("artist"),
    lidarr("album"),
  ]);
  const now = Date.now();
  const byGroup = new Map(albums.map((album) => [album.foreignAlbumId, album]));
  const search = [];
  for (const release of releases) {
    const date = Date.parse(release.releaseDate);
    if (
      !release.mbid ||
      !Number.isFinite(date) ||
      Math.abs(date - now) > releaseWindow ||
      !["Album", "EP", "Single"].includes(release.releaseType)
    )
      continue;

    const label = `${release.artistName} — ${release.title}`;
    const artist = artists.find(
      (entry) => normalize(entry.artistName) === normalize(release.artistName)
    );
    if (!artist) continue;
    try {
      let album = byGroup.get(release.mbid);
      if (!album) {
        const matches = await lidarr(
          "album/lookup?term=lidarr:" + encodeURIComponent(release.mbid)
        );
        const match = matches.find(
          (entry) =>
            entry.foreignAlbumId === release.mbid &&
            entry.artist?.foreignArtistId === artist.foreignArtistId
        );
        if (!match) {
          console.log("Unavailable in Lidarr", label);
          run.issues.push(label + " · No exact match in Lidarr");
          continue;
        }
        console.log(dryRun ? "Would add" : "Adding", label);
        if (dryRun) continue;
        album = await lidarr("album", "POST", {
          ...match,
          id: 0,
          artistId: artist.id,
          artist,
          monitored: true,
          addOptions: { searchForNewAlbum: false },
        });
        byGroup.set(release.mbid, album);
        run.added.push(label);
      }
      const stats = album.statistics;
      if (stats?.trackCount > 0 && stats.trackFileCount >= stats.trackCount)
        continue;
      // Preserve monitoring choices for releases already in Lidarr.
      if (!album.monitored || date > now) continue;
      search.push(album.id);
      run.searched.push(label);
      console.log(dryRun ? "Would search" : "Ready to search", label);
    } catch (error) {
      console.error(label, error.message);
      run.issues.push(label + " · " + error.message);
      process.exitCode = 1;
    }
  }

  if (search.length && !dryRun) {
    const command = await lidarr("command", "POST", {
      name: "AlbumSearch",
      albumIds: [...new Set(search)],
    });
    run.commandId = command.id;
    console.log("Lidarr search command", command.id, command.status);
  }
}

async function syncRecommendedArtists() {
  const [{ recommendations }, artists] = await Promise.all([
    getJson(encore + "/api/recommendations"),
    lidarr("artist"),
  ]);
  const known = new Set(artists.map((artist) => normalize(artist.artistName)));
  let attempts = 0;
  for (const recommendation of recommendations) {
    if (attempts >= artistLookupLimit || run.addedArtists.length >= artistLimit)
      break;

    const name = recommendation.artistName;
    const normalized = normalize(name);
    if (!normalized || known.has(normalized)) continue;
    known.add(normalized);
    attempts++;

    if (dryRun) {
      console.log("Would check artist", name);
      if (attempts >= artistLimit) break;
      continue;
    }

    try {
      const response = await fetch(
        encore +
          "/api/recommendations/" +
          encodeURIComponent(recommendation.id) +
          "/lidarr",
        {
          method: "POST",
          redirect: "error",
          headers: { Origin: encore, "Content-Type": "application/json" },
          body: JSON.stringify({ onlyIfNew: true }),
          signal: AbortSignal.timeout(30000),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        run.issues.push(
          name + " · " + (result.message || `HTTP ${response.status}`)
        );
        console.warn(name, result.message || response.status);
        if (response.status >= 500) process.exitCode = 1;
        continue;
      }
      if (result.added) {
        run.addedArtists.push(name);
        console.log("Artist added and search requested", name);
      }
    } catch (error) {
      run.issues.push(name + " · " + error.message);
      console.error(name, error.message);
      process.exitCode = 1;
    }
  }
}

async function execute() {
  for (const sync of [syncReleases, syncRecommendedArtists]) {
    try {
      await sync();
    } catch (error) {
      run.issues.push(error.message);
      process.exitCode = 1;
      console.error(error.message);
    }
  }

  if (dryRun) return;
  const Redis = require("ioredis");
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  try {
    await redis.set(
      "lidarr:weekly-release-run",
      JSON.stringify({
        ...run,
        finishedAt: new Date().toISOString(),
        failed: Boolean(process.exitCode),
      })
    );
  } finally {
    redis.disconnect();
  }
}

execute().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
