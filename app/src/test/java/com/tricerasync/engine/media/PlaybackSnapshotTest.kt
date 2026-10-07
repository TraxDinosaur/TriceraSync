// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.media

import android.media.session.PlaybackState
import com.tricerasync.engine.core.time.FakeClock
import kotlin.test.Test
import kotlin.test.assertEquals

class PlaybackSnapshotTest {
    private fun snap(state: Int, pos: Long, speed: Float, at: Long) =
        PlaybackSnapshot(state = state, positionMs = pos, speed = speed, updatedAt = at)

    @Test
    fun `playing extrapolates from lastPositionUpdateTime`() {
        val s = snap(PlaybackState.STATE_PLAYING, 10_000, 1f, at = 1_000)
        assertEquals(12_500, s.positionAt(3_500))
    }

    @Test
    fun `speed scales the extrapolation`() {
        val s = snap(PlaybackState.STATE_PLAYING, 10_000, 1.5f, at = 1_000)
        assertEquals(13_000, s.positionAt(3_000))
        val slow = snap(PlaybackState.STATE_PLAYING, 10_000, 0.5f, at = 1_000)
        assertEquals(11_000, slow.positionAt(3_000))
    }

    @Test
    fun `paused and buffering hold the reported position`() {
        assertEquals(10_000, snap(PlaybackState.STATE_PAUSED, 10_000, 1f, 1_000).positionAt(99_000))
        assertEquals(10_000, snap(PlaybackState.STATE_BUFFERING, 10_000, 1f, 1_000).positionAt(99_000))
    }

    @Test
    fun `never negative when the clock is behind the update time`() {
        val s = snap(PlaybackState.STATE_PLAYING, 100, 1f, at = 5_000)
        assertEquals(0, s.positionAt(1_000))
    }

    @Test
    fun `works with the Clock abstraction`() {
        val clock = FakeClock(1_000)
        val s = snap(PlaybackState.STATE_PLAYING, 0, 1f, at = 1_000)
        clock.advance(750)
        assertEquals(750, s.positionAt(clock))
    }
}
