// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const PATH_PREFIXES = ["/shorts/", "/embed/", "/live/", "/v/", "/e/"];

/**
 * Extracts an 11-char YouTube video id from any common URL form, or a bare id.
 * Returns null when the input is not a YouTube video reference.
 * @param {string} input
 * @returns {string | null}
 */
export function parseYouTubeVideoId(input) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (ID_RE.test(s)) return s;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  if (url.hostname.endsWith("youtu.be")) {
    return check(url.pathname.slice(1).split("/")[0]);
  }
  const v = url.searchParams.get("v");
  if (v) return check(v);
  for (const p of PATH_PREFIXES) {
    if (url.pathname.startsWith(p)) return check(url.pathname.slice(p.length).split("/")[0]);
  }
  return null;
}

function check(id) {
  return ID_RE.test(id) ? id : null;
}
