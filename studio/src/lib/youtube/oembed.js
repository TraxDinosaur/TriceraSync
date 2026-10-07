// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { upstream } from "../http/errors.js";

const OEMBED = "https://www.youtube.com/oembed";

/**
 * Fetches title / channel / thumbnail for a video id via YouTube's keyless oEmbed endpoint.
 * Returns null when the video is private, removed, or does not exist (oEmbed answers 401/404).
 * @param {string} videoId
 * @returns {Promise<{ title: string, channel: string, thumbnailUrl: string | null } | null>}
 */
export async function fetchOEmbed(videoId) {
  const url = `${OEMBED}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  } catch (e) {
    throw upstream(`oEmbed request failed: ${e.message}`);
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw upstream(`oEmbed responded ${res.status}`);
  const j = await res.json();
  return {
    title: String(j.title ?? ""),
    channel: String(j.author_name ?? ""),
    thumbnailUrl: j.thumbnail_url ? String(j.thumbnail_url) : null,
  };
}
