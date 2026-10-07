// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Title / channel normalization — README/PRD.md §9.3.
// MUST stay byte-identical with the Engine's core/matching/Normalize.kt.
// Both implementations are tested against normalize-vectors.json.

// Keep \p{M} (combining marks) — Devanagari matras, Arabic harakat etc. are marks, not letters.
const NOT_LETTER_DIGIT_SPACE = /[^\p{L}\p{M}\p{N} ]+/gu;
const WHITESPACE = /\s+/gu;

/**
 * NFKC → lowercase → drop everything except letters, combining marks (e.g. Devanagari matras), digits, spaces →
 * collapse whitespace → trim.
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function normalize(s) {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(WHITESPACE, " ")
    .replace(NOT_LETTER_DIGIT_SPACE, "")
    .replace(WHITESPACE, " ")
    .trim();
}
