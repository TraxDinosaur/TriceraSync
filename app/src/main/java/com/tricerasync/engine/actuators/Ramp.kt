// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Linear ramp helper for state actuators. Calls `apply` every `stepMs` from `from` to `to`
 * over `durationMs`; a zero duration applies `to` immediately. Returns the Job so the caller
 * can cancel a ramp that is superseded by a newer cue.
 */
fun CoroutineScope.ramp(
    from: Float,
    to: Float,
    durationMs: Long,
    stepMs: Long = 16,
    apply: (Float) -> Unit,
): Job = launch {
    if (durationMs <= 0 || from == to) {
        apply(to)
        return@launch
    }
    val start = System.nanoTime()
    while (true) {
        val elapsed = (System.nanoTime() - start) / 1_000_000
        if (elapsed >= durationMs) break
        val t = elapsed.toFloat() / durationMs
        apply(from + (to - from) * t)
        delay(stepMs)
    }
    apply(to)
}
