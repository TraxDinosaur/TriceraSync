// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

const RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Converts an ISO-8601 duration as returned by YouTube Data API (`PT1H2M3S`) to milliseconds.
 * Returns null for anything it cannot parse.
 * @param {string} iso
 * @returns {number | null}
 */
export function isoDurationToMs(iso) {
  if (typeof iso !== "string") return null;
  const m = RE.exec(iso.trim());
  if (!m || iso === "P" || iso === "PT") return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Math.round(((+d * 24 + +h) * 60 + +min) * 60_000 + +s * 1000);
}
