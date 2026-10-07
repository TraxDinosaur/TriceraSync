// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.media

import android.media.session.PlaybackState
import com.tricerasync.engine.core.time.Clock

/**
 * Immutable capture of a PlaybackState — everything needed to extrapolate the current
 * position (PRD §2). `updatedAt` is on the elapsedRealtime timebase.
 */
data class PlaybackSnapshot(
    val state: Int,
    val positionMs: Long,
    val speed: Float,
    val updatedAt: Long,
    val actions: Long = 0L,
    val bufferedMs: Long = 0L,
) {
    val isPlaying: Boolean get() = state == PlaybackState.STATE_PLAYING

    /**
     * pos(now) = position + (now − lastPositionUpdateTime) × speed   while PLAYING
     * pos(now) = position                                             otherwise
     */
    fun positionAt(now: Long): Long =
        if (isPlaying) (positionMs + ((now - updatedAt) * speed).toLong()).coerceAtLeast(0L)
        else positionMs

    fun positionAt(clock: Clock): Long = positionAt(clock.now())

    val stateName: String get() = stateName(state)

    companion object {
        fun from(ps: PlaybackState): PlaybackSnapshot = PlaybackSnapshot(
            state = ps.state,
            positionMs = ps.position,
            speed = ps.playbackSpeed,
            updatedAt = ps.lastPositionUpdateTime,
            actions = ps.actions,
            bufferedMs = ps.bufferedPosition,
        )

        fun stateName(state: Int): String = when (state) {
            PlaybackState.STATE_NONE -> "NONE"
            PlaybackState.STATE_STOPPED -> "STOPPED"
            PlaybackState.STATE_PAUSED -> "PAUSED"
            PlaybackState.STATE_PLAYING -> "PLAYING"
            PlaybackState.STATE_FAST_FORWARDING -> "FAST_FORWARDING"
            PlaybackState.STATE_REWINDING -> "REWINDING"
            PlaybackState.STATE_BUFFERING -> "BUFFERING"
            PlaybackState.STATE_ERROR -> "ERROR"
            PlaybackState.STATE_CONNECTING -> "CONNECTING"
            PlaybackState.STATE_SKIPPING_TO_PREVIOUS -> "SKIPPING_TO_PREVIOUS"
            PlaybackState.STATE_SKIPPING_TO_NEXT -> "SKIPPING_TO_NEXT"
            PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM -> "SKIPPING_TO_QUEUE_ITEM"
            else -> "UNKNOWN($state)"
        }
    }
}
