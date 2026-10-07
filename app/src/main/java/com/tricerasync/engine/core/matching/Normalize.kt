// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core.matching

import java.text.Normalizer

/**
 * Title / channel normalization — MUST stay byte-identical with the App's
 * `src/lib/matching/normalize.js` (App PRD §9.3). Both are tested against the shared
 * `normalize-vectors.json`.
 *
 * NFKC → lowercase → collapse whitespace → keep only letters, combining marks, digits, spaces
 * → collapse whitespace → trim.
 */
object Normalize {
    // JS `\s` (with the u flag) = Unicode White_Space; Java's `\s` is ASCII-only, so spell it out.
    private val WHITESPACE = Regex("[\\s\\p{Z}\\u0085\\uFEFF]+")
    private val NOT_LETTER_MARK_DIGIT_SPACE = Regex("[^\\p{L}\\p{M}\\p{N} ]+")

    fun normalize(s: String?): String {
        if (s.isNullOrEmpty()) return ""
        return Normalizer.normalize(s, Normalizer.Form.NFKC)
            .lowercase()
            .replace(WHITESPACE, " ")
            .replace(NOT_LETTER_MARK_DIGIT_SPACE, "")
            .replace(WHITESPACE, " ")
            .trim()
    }
}
