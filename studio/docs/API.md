# TriceraSync HTTP API Contract

This document defines the HTTP API implemented by the TriceraSync Studio and consumed by the TriceraSync Android Engine and external clients.

All JSON payloads conform to UTF-8. Times are in milliseconds.

---

## 1. Authentication & Security

- **Local Development**: When `ACCESS_TOKEN` (or `DEMO_ACCESS_TOKEN`) is unset and `NODE_ENV != production`, all routes (read and write) are open.
- **Production Mode**: When `NODE_ENV = production`, write operations (`POST`, `PUT`, `PATCH`, `DELETE`) require authentication. If no token is configured on the server, writes return `403 Forbidden`.
- **Token Submission**:
  - Request header: `x-access-token: <token>` or `x-demo-token: <token>`
  - Cookie: `tricerasync_demo=<token>` (set automatically via `/unlock`)

---

## 2. Engine Endpoints (Public)

These endpoints are consumed by the TriceraSync Android companion app.

### 2.1 Resolve Playback Identity

Query for an active cue sheet matching the currently playing YouTube media session.

- **Method**: `GET /api/v1/resolve`
- **Query Parameters**:
  - `title` (`string`, required): Raw title reported by Android `MediaSession`.
  - `channel` (`string`, optional): Channel or artist name reported by `MediaSession`.
  - `durationMs` (`integer`, required): Video duration in milliseconds.
- **Headers**:
  - `If-None-Match`: Optional client-cached ETag (`"<youtubeVideoId>:<sheetVersion>"`).

#### Response: 200 OK
Returns the matched cue sheet with matching confidence:
```json
{
  "match": {
    "videoId": "0PBvTTpnTwI",
    "confidence": "exact"
  },
  "sheet": {
    "version": 1,
    "video": {
      "provider": "youtube",
      "id": "0PBvTTpnTwI",
      "title": "TriceraSync Test Video 1",
      "channel": "TraxDinosaur",
      "durationMs": 11000
    },
    "meta": {
      "sheetVersion": 1,
      "createdAt": "2026-09-12T10:00:00.000Z"
    },
    "defaults": {
      "restoreOnEnd": true,
      "toleranceMs": 120
    },
    "cues": [
      {
        "id": "c_a1",
        "at": 210,
        "type": "vibrate",
        "params": { "mode": "oneShot", "durationMs": 200, "amplitude": 255 }
      }
    ]
  }
}
```
- Headers: `ETag: "<videoId>:<sheetVersion>"`, `Cache-Control: public, max-age=60`.

#### Response: 304 Not Modified
Returned when `If-None-Match` matches current ETag. Body is empty.

#### Response: 404 Not Found
Returned when no active cue sheet matches the query signature within +/- 1500 ms duration window:
```json
{
  "error": "no TriceraSync sheet for this video"
}
```

---

### 2.2 Direct Cue Sheet Fetch

Fetch the latest published cue sheet directly by YouTube video ID.

- **Method**: `GET /api/v1/cue-sheets/:youtubeVideoId`
- **Headers**:
  - `If-None-Match`: Optional client-cached ETag.
- **Response**: 200 OK with raw PCF document, 304 Not Modified, or 404 Not Found.

---

### 2.3 Catalog Index

Returns a compact list of all published videos with active cue sheets. Used by the Engine to perform zero-network duration gating.

- **Method**: `GET /api/v1/catalog`
- **Response: 200 OK**:
```json
[
  {
    "d": 11000,
    "t": "tricerasync test video 1",
    "c": "traxdinosaur",
    "u": "2026-09-12T10:00:00.000Z"
  }
]
```

---

### 2.4 Health Check

- **Method**: `GET /api/v1/health`
- **Response: 200 OK**:
```json
{
  "ok": true,
  "version": "0.1.0",
  "pcfVersion": 1,
  "storage": "ok"
}
```

---

## 3. Project Management Endpoints (Studio)

### 3.1 List Projects
- **Method**: `GET /api/videos`
- **Response: 200 OK**: Array of project objects including activeSheetVersion and cueCount.

### 3.2 Create Project
- **Method**: `POST /api/videos`
- **Body**:
```json
{
  "name": "My Project",
  "source": "youtube",
  "youtubeUrl": "https://www.youtube.com/watch?v=0PBvTTpnTwI",
  "durationMs": 11000
}
```

### 3.3 Save Cue Sheet Version
- **Method**: `PUT /api/videos/:id/cues`
- **Body**:
```json
{
  "cues": [...],
  "meta": { "fps": 30 },
  "defaults": { "restoreOnEnd": true, "toleranceMs": 120 }
}
```
- **Response: 200 OK**: Saved cue sheet record with incremented `sheetVersion`.

### 3.4 Publish Version
- **Method**: `POST /api/videos/:id/publish`
- **Body**: `{ "sheetVersion": 1 }` (optional; defaults to latest)
- **Response: 200 OK**: Updated project record with `status: "published"`.

### 3.5 Unpublish Project
- **Method**: `POST /api/videos/:id/unpublish`
- **Response: 200 OK**: Updated project record with `status: "draft"`.

### 3.6 Recent Resolve History
- **Method**: `GET /api/videos/:id/resolves`
- **Response: 200 OK**: Array of recent resolve requests logged for this project.
