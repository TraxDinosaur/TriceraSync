// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.sync

import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.Defaults
import com.tricerasync.engine.core.time.Clock
import com.tricerasync.engine.media.PlaybackSnapshot

/** Where fired cues go. Implemented by SyncSession (→ ActuatorRegistry) and by test fakes. */
interface CueSink {
    fun fire(cue: Cue, lateMs: Long)
    fun setState(type: String, cue: Cue?)
    /** Pause / seek: stop timed effects (long vibration, torch hold) but keep state values. */
    fun cancelTimed()
}

val STATE_TYPES = listOf("brightness", "volume", "torch")

/**
 * Effective state cue of `type` at time `t` — the last cue with `at ≤ t`; a cue with a hold
 * window only counts while `t < at + durationMs`, otherwise the previous persistent cue (or
 * baseline = null) applies. Identical to the web preview's `stateCueAt` (App PRD §8.3).
 */
fun stateCueAt(cues: List<Cue>, type: String, t: Long): Cue? {
    var persistent: Cue? = null
    var held: Cue? = null
    for (c in cues) {
        if (c.type != type || c.at > t) continue
        val d = c.durationMs
        if (d != null) {
            held = if (t < c.at + d) c else null
        } else {
            persistent = c
            held = null
        }
    }
    return held ?: persistent
}

/**
 * Turns PlaybackSnapshots + clock ticks into cue firings (PRD FR-11..FR-18).
 *
 *  - `onSnapshot()` on every MediaController callback (play / pause / seek / speed).
 *  - `tick()` every ~50 ms while playing (SyncSession drives it).
 *
 * Instant cues fire once when the position crosses `at` — `lastPos < at ≤ pos`; they are never
 * replayed after a seek. State cues are evaluated from the position, so seeks reconcile
 * automatically (FR-14).
 */
class CueScheduler(
    cues: List<Cue>,
    private val defaults: Defaults,
    private val clock: Clock,
    private val sink: CueSink,
    /**
     * User calibration. Negative fires cues earlier, positive later. Applied by shifting the
     * playback position into "cue time"; because it is a constant, all the delta comparisons
     * (seek and drift detection) are unaffected.
     */
    private val offsetMs: Long = 0,
) {
    private val cues: List<Cue> = cues.sortedBy { it.at }
    private var snapshot: PlaybackSnapshot? = null
    private var lastPos: Long? = null
    private val state = HashMap<String, Cue?>().apply { STATE_TYPES.forEach { put(it, null) } }

    /** Number of drift corrections applied (diagnostics). */
    var driftCorrections = 0
        private set
    var seeks = 0
        private set

    val isPlaying: Boolean get() = snapshot?.isPlaying == true

    /** Real playback position, for display. Cue comparisons use [cueTime] of this. */
    val positionNow: Long get() = snapshot?.positionAt(clock.now()) ?: ((lastPos ?: 0L) + offsetMs)

    private fun cueTime(realPos: Long) = realPos - offsetMs

    /**
     * @return false when the snapshot was ignored as stale. `lastPositionUpdateTime` is monotonic
     *   on the elapsedRealtime timebase, so a snapshot older than the one we already hold is a
     *   leftover from before the session started and must not be allowed to re-anchor us — it
     *   would look like a large backwards seek and drag playback back to where the video was
     *   when we first saw it.
     */
    fun onSnapshot(next: PlaybackSnapshot): Boolean {
        val now = clock.now()
        val prev = snapshot
        if (prev != null && next.updatedAt < prev.updatedAt) return false
        val newPos = cueTime(next.positionAt(now))
        snapshot = next

        if (lastPos == null || prev == null) {
            lastPos = newPos
            syncState(newPos)
            return true
        }

        val predicted = cueTime(prev.positionAt(now))
        val delta = newPos - predicted
        when {
            kotlin.math.abs(delta) > SEEK_THRESHOLD_MS -> {
                seeks++
                sink.cancelTimed()
                lastPos = newPos
                syncState(newPos)
            }
            !next.isPlaying -> {
                // Pause / buffering: freeze at the reported position, keep state.
                if (prev.isPlaying) sink.cancelTimed()
                lastPos = newPos
                syncState(newPos)
            }
            prev.isPlaying && kotlin.math.abs(delta) > DRIFT_THRESHOLD_MS -> {
                // Same playback, but the reported position disagrees with our extrapolation.
                driftCorrections++
                lastPos = newPos
            }
            !prev.isPlaying && next.isPlaying -> {
                // Resume: continue from the reported position without firing the paused gap.
                lastPos = newPos
            }
        }
        return true
    }

    /** Where the scheduler currently believes playback is, in cue time (diagnostics). */
    val anchor: Long? get() = lastPos

    /** Advance to the current position and fire whatever was crossed. No-op while paused. */
    fun tick(): Long {
        val snap = snapshot ?: return lastPos ?: 0L
        val pos = cueTime(snap.positionAt(clock.now()))
        if (!snap.isPlaying) return pos
        val from = lastPos ?: pos
        if (pos < from) {
            // Position went backwards without a snapshot — treat like a seek.
            seeks++
            sink.cancelTimed()
            lastPos = pos
            syncState(pos)
            return pos
        }
        for (c in cues) {
            if (c.at <= from) continue
            if (c.at > pos) break
            if (c.isInstant) sink.fire(c, pos - c.at)
        }
        lastPos = pos
        syncState(pos)
        return pos
    }

    /** Back to baseline for every state type (session end). */
    fun reset() {
        for (t in STATE_TYPES) {
            if (state[t] != null) {
                state[t] = null
                sink.setState(t, null)
            }
        }
        lastPos = null
        snapshot = null
    }

    private fun syncState(pos: Long) {
        for (t in STATE_TYPES) {
            val next = stateCueAt(cues, t, pos)
            if (next !== state[t]) {
                state[t] = next
                sink.setState(t, next)
            }
        }
    }

    companion object {
        const val SEEK_THRESHOLD_MS = 400L
        const val DRIFT_THRESHOLD_MS = 250L
    }
}
