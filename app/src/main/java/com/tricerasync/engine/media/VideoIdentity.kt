// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.media

import com.tricerasync.engine.core.matching.Normalize

/**
 * What identifies "the video currently playing" (PRD FR-06). Two sessions with the same
 * identity are the same video; a change (including an ad's different duration) ends a sync
 * session and triggers a new resolve.
 */
data class VideoIdentity(
    val rawTitle: String,
    val rawChannel: String?,
    val durationMs: Long,
) {
    val titleNorm: String = Normalize.normalize(rawTitle)
    val channelNorm: String = Normalize.normalize(rawChannel)

    /** Cache / comparison key. */
    val key: String get() = "$titleNorm|$channelNorm|$durationMs"

    companion object {
        /** Null while metadata is incomplete (YouTube emits partial metadata during load). */
        fun from(title: String?, channel: String?, durationMs: Long?): VideoIdentity? {
            if (title.isNullOrBlank() || durationMs == null || durationMs <= 0) return null
            return VideoIdentity(title, channel, durationMs)
        }
    }
}

/** Latest known state of the target (YouTube) session — what the sync layer consumes. */
data class TargetPlayback(
    val packageName: String,
    val identity: VideoIdentity?,
    val snapshot: PlaybackSnapshot?,
)
