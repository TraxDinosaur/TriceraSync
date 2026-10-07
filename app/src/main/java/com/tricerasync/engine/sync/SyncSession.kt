// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.sync

import com.tricerasync.engine.actuators.ActuatorRegistry
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.CueSheet
import com.tricerasync.engine.core.time.Clock
import com.tricerasync.engine.core.time.RealClock
import com.tricerasync.engine.media.PlaybackSnapshot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

/** One fired cue, for the Home screen's recent list (PRD FR-25). */
data class FiredCue(val id: String, val type: String, val at: Long, val lateMs: Long, val wallMs: Long)

data class SessionUi(
    val title: String,
    val positionMs: Long = 0,
    val playing: Boolean = false,
    val cueCount: Int = 0,
    val fired: List<FiredCue> = emptyList(),
    val seeks: Int = 0,
    val drift: Int = 0,
)

/**
 * Owns one video's sync: scheduler tick loop + actuator sink + baseline restore (PRD FR-11,
 * FR-17, FR-19). Feed it PlaybackSnapshots; call `stop()` when the video ends or changes.
 */
class SyncSession(
    val sheet: CueSheet,
    private val registry: ActuatorRegistry,
    private val scope: CoroutineScope,
    private val clock: Clock = RealClock,
    private val tickMs: Long = 25,
    private val offsetMs: Long = 0,
) {
    private val _ui = MutableStateFlow(SessionUi(title = sheet.video.title ?: "?", cueCount = sheet.playable.size))
    val ui: StateFlow<SessionUi> = _ui

    private val playingFlow = MutableStateFlow(false)
    private var loop: Job? = null
    private var seeded = false
    private var lastPublishAt = 0L
    private val fired = ArrayDeque<FiredCue>(RECENT)

    private val sink = object : CueSink {
        override fun fire(cue: Cue, lateMs: Long) {
            registry.fire(cue)
            if (lateMs > sheet.defaults.toleranceMs) RingLog.log(TAG, "LATE ${cue.id} by ${lateMs}ms")
            if (fired.size >= RECENT) fired.removeFirst()
            fired.addLast(FiredCue(cue.id, cue.type, cue.at, lateMs, System.currentTimeMillis()))
            _ui.value = _ui.value.copy(fired = fired.toList())
            lastPublishAt = 0L // let the next publish through, so the position catches up with it
        }

        override fun setState(type: String, cue: Cue?) = registry.setState(type, cue)
        override fun cancelTimed() = registry.cancelAll()
    }

    val scheduler = CueScheduler(sheet.playable, sheet.defaults, clock, sink, offsetMs)

    fun start() {
        if (loop != null) return
        registry.startSession()
        RingLog.log(
            TAG,
            "start \"${sheet.video.title}\" v${sheet.meta.sheetVersion} " +
                "(${sheet.playable.size} cues, tick ${tickMs}ms, offset ${offsetMs}ms)",
        )
        loop = scope.launch {
            while (true) {
                if (!playingFlow.value) {
                    publish(force = true)
                    playingFlow.first { it }
                    publish(force = true)
                }
                withContext(Dispatchers.Main.immediate) { scheduler.tick() }
                publish()
                delay(tickMs)
            }
        }
    }

    /** @return false when the snapshot was ignored as stale (see [CueScheduler.onSnapshot]). */
    fun onPlayback(snapshot: PlaybackSnapshot): Boolean {
        val accepted = scheduler.onSnapshot(snapshot)
        if (!accepted) {
            RingLog.log(TAG, "ignored stale snapshot (pos=${snapshot.positionMs})")
            return false
        }
        if (!seeded) {
            seeded = true
            RingLog.log(
                TAG,
                "anchored at ${scheduler.anchor} ms (${snapshot.stateName})" +
                    if (!snapshot.isPlaying) " — waiting for playback to start" else "",
            )
        }
        playingFlow.value = snapshot.isPlaying
        publish(force = true)
        return true
    }

    /** Ends the session; restores device state when the sheet asks for it (default true). */
    fun stop(reason: String) {
        loop?.cancel()
        loop = null
        scheduler.reset()
        if (sheet.defaults.restoreOnEnd) registry.endSession() else registry.cancelAll()
        RingLog.log(TAG, "stop ($reason)")
    }

    /**
     * Pushes scheduler state to the UI, rate-limited.
     *
     * The scheduler ticks every 25 ms, but a position readout does not need 40 updates a second —
     * and every one of them recomposes the home screen on the main thread, which is the same
     * thread the tick loop runs on. Publishing at ~10 Hz keeps the readout smooth while leaving
     * the loop free to keep time. Anything the user must see immediately (a fired cue, a state
     * change) forces a publish.
     */
    private fun publish(force: Boolean = false) {
        val now = clock.now()
        if (!force && now - lastPublishAt < PUBLISH_INTERVAL_MS) return
        lastPublishAt = now
        _ui.value = _ui.value.copy(
            positionMs = scheduler.positionNow,
            playing = scheduler.isPlaying,
            seeks = scheduler.seeks,
            drift = scheduler.driftCorrections,
        )
    }

    private companion object {
        const val TAG = "Session"
        const val RECENT = 20
        const val PUBLISH_INTERVAL_MS = 100L
    }
}
