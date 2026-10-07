# TriceraSync Studio Storage Architecture

TriceraSync Studio places all persistence behind a minimal `StorageAdapter` interface. This allows the open-source Studio to run with zero external services out of the box (using the default file-based JSON store), while enabling private deployments to plug in custom database engines (such as PostgreSQL with Neon, Supabase, or self-hosted Postgres) without modifying or forking any editor code.

---

## 1. How It Works

- The application layer (`src/lib/videos/repo.js`, `src/lib/matching/match.js`, `src/lib/v1/respond.js`) communicates only with `getStorage()` from `@/lib/storage`.
- Shipped default: `JsonFileStorage` (`src/lib/storage/JsonFileStorage.js`), which persists project records, cue sheet versions, and resolve query logs to `.data/studio-store.json`.
- The storage path can be customized using `STORAGE_FILE=/custom/path/store.json`.

---

## 2. Implementing a Production Adapter (e.g., PostgreSQL)

To attach a private production database:

1. Create `src/lib/storage/PostgresStorage.js` in your private workspace.
2. Implement the following interface methods:

```javascript
export class PostgresStorage {
  // Project Management
  async listVideos() {}
  async getVideo(id) {}
  async getVideoByYouTubeId(youtubeVideoId) {}
  async createVideo({ name, source, localFileName, durationMs, youtube }) {}
  async updateVideo(id, patch) {}
  async deleteVideo(id) {}

  // Cue Sheets & Versioning
  async saveCueSheet(videoId, { cues, meta, defaults }) {}
  async getCueSheet(videoId, { version, preferActive } = {}) {}
  async listCueSheets(videoId) {}
  async publishVideo(videoId, sheetVersion) {}
  async unpublishVideo(videoId) {}

  // Engine & Resolving
  async catalogEntries() {}
  async matchVideo({ titleNorm, channelNorm, durationMs }) {}
  async findPublishedByYouTubeId(youtubeVideoId) {}
  async activeSheetFor(videoId) {}
  async logResolve({ title, channel, durationMs, matchedId, confidence }) {}
  async recentResolves(videoId, limit = 12) {}
}
```

3. Set `STORAGE_ADAPTER=postgres` in your deployment environment variables.
4. The factory `getStorage()` in `src/lib/storage/index.js` automatically instantiates `PostgresStorage`.
