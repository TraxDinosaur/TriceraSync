# TriceraSync Studio

Web timeline editor where creators attach physical device effects — vibration, display brightness, audio volume, screen flashes, and camera torch — to videos, plus the API that serves cue sheets to the [TriceraSync Android Engine](../README.md).

**The video is never uploaded.** Creators annotate videos in their browser (either from local files or YouTube embeds), and only cue sheet timestamps and metadata are saved.

---

## Quick Start (Zero-Setup)

TriceraSync Studio is completely self-hostable with **zero external databases or services required**. It ships with a built-in file-based storage engine that writes to `.data/studio-store.json`.

### Prerequisites

- [Bun](https://bun.sh) (v1.1+) or Node.js (v18+)

### Install and Run

```bash
bun install
bun run dev
```

The server starts at `http://localhost:3000` and binds to `0.0.0.0` so your Android phone running the Engine on the same local network can connect directly.

To run only on localhost:
```bash
bun run dev:local
```

### Scripts

| Script | Command | Description |
|---|---|---|
| `bun run dev` | `next dev -H 0.0.0.0` | Starts development server on all interfaces |
| `bun test` | `bun test` | Runs the test suite (108 unit tests) |
| `bun run build` | `next build` | Compiles optimized production bundle |
| `bun run start` | `next start` | Runs production server |
| `bun run lint` | `eslint` | Runs code linter |

---

## Connecting the Engine

1. Start the Studio (`bun run dev`).
2. Find your computer's local IP address (e.g. `192.168.1.50`).
3. Open TriceraSync Engine on your Android device.
4. Go to **Settings** -> set **Base URL** to `http://<your-computer-ip>:3000` -> tap **Save**.
5. When you play your published video in YouTube, the Engine resolves the cue sheet from your local Studio!

---

## Persistence & Storage Architecture

Persistence is decoupled through the `StorageAdapter` interface (`src/lib/storage/index.js`):
- **Default (Shipped)**: `JsonFileStorage` (`src/lib/storage/JsonFileStorage.js`). Requires zero setup and stores projects, cue sheet versions, and resolve logs in `.data/studio-store.json`.
- **Custom Adapters**: Private deployments (such as the official hosted service) plug in their own PostgreSQL adapter by providing `PostgresStorage.js` and setting `STORAGE_ADAPTER=postgres`. See [`docs/STORAGE.md`](docs/STORAGE.md) for full instructions.

---

## Authentication

- **Local Development (`NODE_ENV != production`)**: Leaving `ACCESS_TOKEN` empty allows full open access for creating, editing, and publishing cue sheets.
- **Production (`NODE_ENV=production`)**: Set `ACCESS_TOKEN=your_secure_token` in your environment. If no token is set in production, write operations are blocked. Present the token via the `x-access-token` header or enter it once at `/unlock`.

---

## API Contract

The Studio implements the public Engine API:
- `GET /api/v1/resolve?title&channel&durationMs`: Matches playing YouTube video and returns active PCF v1 sheet
- `GET /api/v1/cue-sheets/:youtubeVideoId`: Fetches PCF cue sheet directly
- `GET /api/v1/catalog`: Returns indexed video durations for zero-network gating
- `GET /api/v1/health`: Server and storage health check

Complete API documentation is in [`docs/API.md`](docs/API.md).

---


## Privacy & Logging

- **Zero video media stored**: Videos remain in the creator browser and are never uploaded.
- **Zero user-identifiable data logged**: The resolve endpoint (`/api/v1/resolve`) and storage adapter store **zero IP addresses, zero user agents, and zero device IDs**.
- **Capped lookup activity**: Resolve logs only record query video signatures (`title`, `channel`, `durationMs`, matched project ID, confidence, and timestamp) solely for the live activity view in the creator dashboard. Storage strictly caps history to the last 500 entries.

## License

Licensed under the **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. See [LICENSE](LICENSE).

&copy; 2026 TraxDinosaur
