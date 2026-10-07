// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { conflict, notFound } from "../http/errors.js";
import { normalize } from "../matching/normalize.js";

const DURATION_WINDOW_MS = 1500;
const FUZZY_THRESHOLD = 0.85;

/** Trigram similarity (compatible with PostgreSQL pg_trgm). */
function trigramSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const tri = (s) => {
    const padded = `  ${s} `;
    const set = new Set();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const setA = tri(a);
  const setB = tri(b);
  let common = 0;
  for (const t of setA) {
    if (setB.has(t)) common++;
  }
  const total = setA.size + setB.size;
  return total === 0 ? 0 : (2 * common) / total;
}

/**
 * Self-contained file-based storage implementation.
 * Stores data as JSON in `.data/studio-store.json`.
 */
export class JsonFileStorage {
  constructor(filePath) {
    this.filePath = filePath || path.resolve(process.cwd(), ".data", "studio-store.json");
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async _load() {
    if (this.data) return this.data;
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      this.data = JSON.parse(content);
    } catch {
      this.data = { videos: [], cueSheets: [], resolveLogs: [] };
      await this._persist();
    }
    return this.data;
  }

  async _persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const tempPath = `${this.filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeQueue;
  }

  async listVideos() {
    const db = await this._load();
    return db.videos
      .map((v) => {
        const sheets = db.cueSheets.filter((s) => s.videoId === v.id);
        const active = sheets.find((s) => s.isActive);
        const latest = sheets.reduce((max, s) => Math.max(max, s.sheetVersion), 0);
        return {
          id: v.id,
          name: v.name,
          source: v.source,
          youtubeVideoId: v.youtubeVideoId,
          title: v.title,
          channelName: v.channelName,
          durationMs: v.durationMs,
          status: v.status,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          activeSheetVersion: active ? active.sheetVersion : null,
          cueCount: active ? active.cues.length : null,
          latestSheetVersion: latest > 0 ? latest : null,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getVideo(id) {
    const db = await this._load();
    const v = db.videos.find((x) => x.id === id);
    if (!v) throw notFound("video");
    return v;
  }

  async getVideoByYouTubeId(youtubeVideoId) {
    const db = await this._load();
    return db.videos.find((x) => x.youtubeVideoId === youtubeVideoId) ?? null;
  }

  async createVideo(input) {
    const db = await this._load();
    if (input.youtube) {
      await this._assertYouTubeIdFree(input.youtube.videoId);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const video = {
      id,
      name: input.name,
      source: input.source,
      localFileName: input.localFileName ?? null,
      durationMs: input.durationMs ?? input.youtube?.durationMs ?? null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      ...(input.youtube ? this._youtubeColumns(input.youtube) : {}),
    };
    db.videos.push(video);
    await this._persist();
    return video;
  }

  async updateVideo(id, patch) {
    const db = await this._load();
    const idx = db.videos.findIndex((x) => x.id === id);
    if (idx === -1) throw notFound("video");

    if (patch.youtube) {
      await this._assertYouTubeIdFree(patch.youtube.videoId, id);
    }

    const current = db.videos[idx];
    const updated = {
      ...current,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.localFileName !== undefined && { localFileName: patch.localFileName }),
      ...(patch.durationMs !== undefined && { durationMs: patch.durationMs }),
      ...(patch.youtube && { source: "youtube", ...this._youtubeColumns(patch.youtube) }),
      ...(patch.youtube?.durationMs != null && { durationMs: patch.youtube.durationMs }),
      updatedAt: new Date().toISOString(),
    };
    db.videos[idx] = updated;
    await this._persist();
    return updated;
  }

  async deleteVideo(id) {
    const db = await this._load();
    const initLen = db.videos.length;
    db.videos = db.videos.filter((v) => v.id !== id);
    if (db.videos.length === initLen) throw notFound("video");
    db.cueSheets = db.cueSheets.filter((s) => s.videoId !== id);
    await this._persist();
  }

  async saveCueSheet(videoId, { cues, meta, defaults }) {
    const db = await this._load();
    await this.getVideo(videoId);
    const existing = db.cueSheets.filter((s) => s.videoId === videoId);
    const nextVersion = existing.reduce((max, s) => Math.max(max, s.sheetVersion), 0) + 1;
    const now = new Date().toISOString();
    const sheet = {
      id: crypto.randomUUID(),
      videoId,
      sheetVersion: nextVersion,
      cues,
      meta: { ...meta, defaults },
      isActive: false,
      createdAt: now,
    };
    db.cueSheets.push(sheet);
    const v = db.videos.find((x) => x.id === videoId);
    if (v) v.updatedAt = now;
    await this._persist();
    return sheet;
  }

  async getCueSheet(videoId, { version, preferActive = false } = {}) {
    const db = await this._load();
    const sheets = db.cueSheets.filter((s) => s.videoId === videoId);
    if (sheets.length === 0) return null;

    if (version != null) {
      return sheets.find((s) => s.sheetVersion === version) ?? null;
    }
    if (preferActive) {
      const active = sheets.find((s) => s.isActive);
      if (active) return active;
    }
    return sheets.sort((a, b) => b.sheetVersion - a.sheetVersion)[0] ?? null;
  }

  async listCueSheets(videoId) {
    const db = await this._load();
    return db.cueSheets
      .filter((s) => s.videoId === videoId)
      .map((s) => ({
        id: s.id,
        sheetVersion: s.sheetVersion,
        isActive: s.isActive,
        createdAt: s.createdAt,
        cueCount: s.cues.length,
      }))
      .sort((a, b) => b.sheetVersion - a.sheetVersion);
  }

  async publishVideo(videoId, sheetVersion) {
    const db = await this._load();
    const video = await this.getVideo(videoId);
    if (!video.youtubeVideoId) throw conflict("link a YouTube URL before publishing");
    if (video.durationMs == null) throw conflict("duration is required before publishing");

    const sheets = db.cueSheets.filter((s) => s.videoId === videoId);
    const target =
      sheetVersion != null
        ? sheets.find((s) => s.sheetVersion === sheetVersion)
        : sheets.sort((a, b) => b.sheetVersion - a.sheetVersion)[0];

    if (!target) {
      throw notFound(sheetVersion != null ? `cue sheet v${sheetVersion}` : "cue sheet");
    }

    for (const s of sheets) {
      s.isActive = s.id === target.id;
    }
    video.status = "published";
    video.updatedAt = new Date().toISOString();
    await this._persist();
    return video;
  }

  async unpublishVideo(videoId) {
    const db = await this._load();
    const video = await this.getVideo(videoId);
    for (const s of db.cueSheets.filter((x) => x.videoId === videoId)) {
      s.isActive = false;
    }
    video.status = "draft";
    video.updatedAt = new Date().toISOString();
    await this._persist();
    return video;
  }

  async recentResolves(videoId, limit = 12) {
    const db = await this._load();
    const logs = db.resolveLogs || [];
    return logs
      .filter((l) => (videoId ? l.matchedId === videoId || l.matchedId == null : true))
      .slice(-limit)
      .reverse();
  }

  async logResolve({ title, channel, durationMs, matchedId = null, confidence = null }) {
    const db = await this._load();
    if (!db.resolveLogs) db.resolveLogs = [];
    const entry = {
      id: crypto.randomUUID(),
      title: title ? title.slice(0, 500) : null,
      channel: channel ? channel.slice(0, 200) : null,
      durationMs: durationMs ?? null,
      matchedId,
      confidence,
      createdAt: new Date().toISOString(),
    };
    db.resolveLogs.push(entry);
    if (db.resolveLogs.length > 500) {
      db.resolveLogs = db.resolveLogs.slice(-500);
    }
    await this._persist();
    return entry;
  }

  async catalogEntries() {
    const db = await this._load();
    const published = db.videos.filter(
      (v) =>
        v.status === "published" &&
        v.durationMs != null &&
        db.cueSheets.some((s) => s.videoId === v.id && s.isActive),
    );
    return published
      .map((v) => ({
        d: v.durationMs,
        t: v.titleNorm,
        c: v.channelNorm,
        u: v.updatedAt,
      }))
      .sort((a, b) => a.d - b.d);
  }

  async matchVideo({ titleNorm, channelNorm, durationMs }) {
    const db = await this._load();
    const candidates = db.videos.filter(
      (v) =>
        v.status === "published" &&
        v.durationMs != null &&
        Math.abs(v.durationMs - durationMs) <= DURATION_WINDOW_MS &&
        db.cueSheets.some((s) => s.videoId === v.id && s.isActive),
    );

    if (candidates.length === 0) return null;

    if (channelNorm) {
      const exact = candidates.find(
        (v) => v.titleNorm === titleNorm && v.channelNorm === channelNorm,
      );
      if (exact) return { video: exact, confidence: "exact" };
    }

    const titleOnly = candidates.find((v) => v.titleNorm === titleNorm);
    if (titleOnly) return { video: titleOnly, confidence: "title-only" };

    let best = null;
    let bestScore = 0;
    for (const v of candidates) {
      const score = trigramSimilarity(v.titleNorm, titleNorm);
      if (score >= FUZZY_THRESHOLD && score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    if (best) return { video: best, confidence: "fuzzy" };

    return null;
  }

  async findPublishedByYouTubeId(youtubeVideoId) {
    const db = await this._load();
    return (
      db.videos.find((v) => v.status === "published" && v.youtubeVideoId === youtubeVideoId) ?? null
    );
  }

  async activeSheetFor(videoId) {
    const db = await this._load();
    return db.cueSheets.find((s) => s.videoId === videoId && s.isActive) ?? null;
  }

  _youtubeColumns(yt) {
    if (!yt) return {};
    return {
      youtubeVideoId: yt.videoId,
      title: yt.title,
      channelName: yt.channel,
      channelId: yt.channelId ?? null,
      titleNorm: normalize(yt.title),
      channelNorm: normalize(yt.channel),
    };
  }

  async _assertYouTubeIdFree(youtubeVideoId, exceptVideoId) {
    const existing = await this.getVideoByYouTubeId(youtubeVideoId);
    if (existing && existing.id !== exceptVideoId) {
      throw conflict("this YouTube video is already linked to another project", {
        existingVideoId: existing.id,
        existingName: existing.name,
      });
    }
  }
}
