// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { isoDurationToMs } from "./isoDuration.js";

const ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

/**
 * Optional enrichment via YouTube Data API v3. Returns null when no key is configured,
 * the request fails, or the video is not found — callers must treat it as best-effort.
 * @param {string} videoId
 * @returns {Promise<{ title: string, channel: string, channelId: string, durationMs: number | null } | null>}
 */
export async function fetchDataApi(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const url = `${ENDPOINT}?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const item = (await res.json()).items?.[0];
    if (!item) return null;
    return {
      title: item.snippet?.title ?? "",
      channel: item.snippet?.channelTitle ?? "",
      channelId: item.snippet?.channelId ?? "",
      durationMs: isoDurationToMs(item.contentDetails?.duration ?? ""),
    };
  } catch {
    return null;
  }
}
