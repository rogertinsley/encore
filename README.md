# Encore

[![CI/CD](https://github.com/rogertinsley/encore/actions/workflows/ci.yml/badge.svg)](https://github.com/rogertinsley/encore/actions/workflows/ci.yml)
[![Docker](https://ghcr-badge.egpl.dev/rogertinsley/encore/latest_tag?trim=major&label=ghcr.io)](https://github.com/rogertinsley/encore/pkgs/container/encore)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)

A personal music display and discovery app. Connects to an EverSolo music player for live playback state, enriches it with artist visuals and metadata, and surfaces recommendations and new releases based on Last.FM listening history.

## Features

- **Now Playing** — full-bleed artist backgrounds (Fanart.tv), album art from EverSolo / Cover Art Archive, live progress bar, play/pause/skip controls, audio quality badge (FLAC · 16-bit · 44.1 kHz). Updates via Server-Sent Events.
- **Recommendations** — scored by similarity + tag overlap, weighted by your play counts. Refreshed daily.
- **New Releases** — albums, EPs, and singles from artists you listen to, within a configurable date window. Refreshed daily.
- **Artist pages** — bio, top tracks, albums with cover art, similar artists.

## Stack

| Layer      | Tech                                           |
| ---------- | ---------------------------------------------- |
| Frontend   | Next.js 15 (App Router), React 19, Tailwind v4 |
| Language   | TypeScript 5                                   |
| Database   | PostgreSQL 16 + Prisma 6                       |
| Cache      | Redis 7 (now-playing state, page caching)      |
| Deployment | Docker Compose                                 |

## Docker image

```
docker pull ghcr.io/rogertinsley/encore:latest
```

Built and pushed to GHCR automatically on every merge to `main`.

## Setup

### 1. Copy env file

```bash
cp .env.example .env
```

| Variable            | Where to get it                                               |
| ------------------- | ------------------------------------------------------------- |
| `LASTFM_API_KEY`    | https://www.last.fm/api/account/create                        |
| `LASTFM_USERNAME`   | Your Last.FM username                                         |
| `FANART_TV_API_KEY` | https://fanart.tv/get-an-api-key (project key, not personal)  |
| `EVERSOLO_HOST`     | IP address of your EverSolo device (default: `192.168.1.138`) |

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

## External APIs

| API                                                        | Usage                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [Last.FM](https://www.last.fm/api)                         | Artist/album metadata, listening history                        |
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) | Artist MBIDs, release groups (rate-limited: 1 req/s)            |
| [Fanart.tv](https://fanart.tv/api-docs/music-api/)         | Artist backgrounds and thumbnails                               |
| [Cover Art Archive](https://coverartarchive.org/)          | Album art (no key required)                                     |
| [EverSolo](https://www.eversolo.com/)                      | Live playback state and controls via local HTTP API (port 9529) |

## Encore Display on Android

1. Connect the Pixel to the home network or Tailscale and open `https://encore.rogertinsley.com/display` in Chrome.
2. Open Chrome's menu and choose **Install app** (or **Add to Home screen**, if Chrome offers installation there). Confirm installation.
3. Launch **Encore** from its own home-screen icon. It starts directly on `/display`.
4. Mount the phone horizontally. To change the layout or idle behavior, tap the discreet menu in the upper-right corner or long-press the display. Preferences are stored only in that browser's local storage.

The installed app requests fullscreen display mode and falls back to standalone where fullscreen is unavailable. A normal Chrome tab still shows browser controls. A plain website shortcut may also open in Chrome instead of the installed app; use **Install app** when available. Chrome and Android decide how much system UI remains visible. The layout follows device rotation automatically; the layout setting changes Encore's arrangement but cannot lock Android orientation.

While playing, the display shows artwork and live progress. When paused, the track stays visible for the chosen idle timeout (default two minutes), then becomes mostly black. When playback stops, the idle screen appears immediately. The optional clock moves slowly to avoid a fixed bright mark. The wake lock option is off by default and requests that Android keep the screen awake only while music is playing and Encore is visible; Android may deny it. Encore's dim appearance does **not** lower physical screen brightness. Set brightness, screen timeout, charging limits and any battery optimisation on the Pixel itself.

The display needs a live connection to Encore. It does not cache playback data for offline use, so it cannot show an old track as live. An interrupted SSE connection is labelled and reconnects automatically. The existing server poller keeps running independently of the phone. No new service, database or environment variable is required.

Encore currently has no login layer: access to the private home network/Tailscale is its access boundary. The command endpoint rejects cross-origin browser posts, but **any client that can reach Encore can send playback commands**. Keep the site restricted to trusted network members; add authentication before exposing it publicly.
