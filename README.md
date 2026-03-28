# Encore

A personal music display and discovery app. Connects to an EverSolo music player for live playback state, enriches it with artist visuals and metadata, and surfaces recommendations and new releases based on Last.FM listening history.

## Features

- **Now Playing** — full-bleed artist backgrounds (Fanart.tv), album art from EverSolo / Cover Art Archive, live progress bar, play/pause/skip controls, audio quality badge (FLAC · 16-bit · 44.1 kHz). Updates via Server-Sent Events.
- **Recommendations** — scored by similarity + tag overlap, weighted by your play counts. Refreshed daily.
- **New Releases** — albums, EPs, and singles from artists you listen to, within a configurable date window. Refreshed daily.
- **Artist pages** — bio, top tracks, albums with cover art, similar artists.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma 6
- Redis (now-playing state, page caching)
- Tailwind v4
- Docker Compose

## Setup

### 1. Copy env file

```bash
cp .env.example .env
```

Fill in:

| Variable            | Where to get it                                              |
| ------------------- | ------------------------------------------------------------ |
| `LASTFM_API_KEY`    | https://www.last.fm/api/account/create                       |
| `LASTFM_USERNAME`   | Your Last.FM username                                        |
| `FANART_TV_API_KEY` | https://fanart.tv/get-an-api-key (project key, not personal) |
| `EVERSOLO_HOST`     | IP address of your EverSolo device (default: 192.168.1.138)  |

### 2. Run with Docker

```bash
docker compose up
```

The app will be available at `http://localhost:3000`. Database migrations run automatically on startup.

### 3. Run locally (dev)

Start just the backing services, then run Next.js directly:

```bash
docker compose up db cache -d
npm install
npm run db:push      # sync schema to local DB
npm run dev
```

## Development

```bash
npm run test         # vitest watch mode
npm run test:run     # single run
npm run db:migrate   # apply migrations (production)
npm run db:generate  # regenerate Prisma client after schema changes
```

## Architecture

Background jobs start automatically when the server boots (`instrumentation.ts`):

- **Now-playing poller** — every 3s, polls EverSolo for playback state, enriches on track change (Last.FM bio, Fanart.tv artist images, Cover Art Archive album art), writes to Redis
- **Recommendations job** — daily, writes to `Recommendation` table
- **New releases job** — daily, writes to `NewRelease` table

Each job skips if data is less than 20 hours old, so server restarts don't trigger redundant API calls.

External APIs used:

- [Last.FM](https://www.last.fm/api) — artist/album metadata, listening history
- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) — artist MBIDs, release groups (rate-limited: 1 req/s)
- [Fanart.tv](https://fanart.tv/api-docs/music-api/) — artist backgrounds and thumbnails
- [Cover Art Archive](https://coverartarchive.org/) — album art (no key required)
- [EverSolo](https://www.eversolo.com/) — live playback state and controls via local HTTP API (port 9529)
