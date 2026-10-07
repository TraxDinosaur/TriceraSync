// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core.time

import android.os.SystemClock

/** Monotonic clock abstraction so the scheduler can be unit-tested with a fake. */
interface Clock {
    /** Milliseconds on the same timebase as PlaybackState.lastPositionUpdateTime. */
    fun now(): Long
}

object RealClock : Clock {
    override fun now(): Long = SystemClock.elapsedRealtime()
}

class FakeClock(private var t: Long = 0L) : Clock {
    override fun now(): Long = t
    fun advance(ms: Long) { t += ms }
    fun set(ms: Long) { t = ms }
}
