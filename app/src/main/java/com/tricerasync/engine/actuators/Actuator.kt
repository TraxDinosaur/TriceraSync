// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.Cue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * One device effect. Instant actuators (vibrate, flash) implement `fire`; state actuators
 * (brightness, volume, torch) implement `set(cue)` / `set(null)` = baseline. Every actuator
 * owns its own baseline capture + restore (plan principle #3).
 */
abstract class Actuator(val type: String) {
    /** Human-readable reason this actuator is unavailable, or null when usable (FR-02). */
    open fun unavailableReason(): String? = null

    /** Called when a sync session starts: capture whatever `restore()` needs. */
    open fun onSessionStart() {}

    /** Instant cues. Default: no-op. */
    open fun fire(cue: Cue, intensity: Float) {}

    /** State cues. `null` means "back to baseline". Default: no-op. */
    open fun set(cue: Cue?) {}

    /** Stop timed effects (pause / seek). Keep state values. */
    open fun cancel() {}

    /** Put the device back exactly as found. Must be idempotent and safe before onSessionStart. */
    open fun restore() {}

    protected fun log(msg: String) = RingLog.log("Act/$type", msg)
}

/** Registry of actuators keyed by cue type; the scheduler talks only to this. */
class ActuatorRegistry(context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val ctx = context.applicationContext
    private val baselines = BaselineStore(ctx)

    val vibrate = VibrateActuator(ctx)
    val brightness = BrightnessActuator(ctx, scope, baselines)
    val volume = VolumeActuator(ctx, scope, baselines)
    val flash = FlashOverlayActuator(ctx, scope)
    val torch = TorchActuator(ctx, scope)

    val all: List<Actuator> = listOf(vibrate, brightness, volume, flash, torch)
    private val byType = all.associateBy { it.type }

    /** Global intensity 0.25–1.0 scales vibration amplitude and flash opacity (FR-20). */
    @Volatile
    var intensity: Float = 1f

    @Volatile
    var flashEnabled: Boolean = true

    @Volatile
    var sessionActive = false
        private set

    fun startSession() {
        if (sessionActive) return
        sessionActive = true
        all.forEach { a ->
            runCatching { a.onSessionStart() }.onFailure { RingLog.log("Act", "${a.type} start failed: ${it.message}") }
        }
        RingLog.log("Act", "session started")
    }

    fun fire(cue: Cue) {
        if (cue is Cue.Flash && !flashEnabled) return
        val a = byType[cue.type] ?: return
        runCatching { a.fire(cue, intensity) }
            .onFailure { RingLog.log("Act", "${cue.type} fire failed: ${it.message}") }
    }

    fun setState(type: String, cue: Cue?) {
        val a = byType[type] ?: return
        runCatching { a.set(cue) }
            .onFailure { RingLog.log("Act", "$type set failed: ${it.message}") }
    }

    fun cancelAll() = all.forEach { runCatching { it.cancel() } }

    /**
     * Undo anything a previous run changed but never restored — force-stop, low-memory kill or
     * a reboot in the middle of a video. Safe to call on every app start; a no-op when clean.
     */
    fun restoreOrphanedBaselines() {
        if (sessionActive || !baselines.hasOrphan) return
        RingLog.log("Act", "found system state left over from a previous run, restoring")
        brightness.restoreOrphan()
        volume.restoreOrphan()
        runCatching { torch.restore() }
    }

    /** Restore everything and end the session. Safe to call any number of times. */
    fun endSession() {
        all.forEach { a ->
            runCatching { a.cancel() }
            runCatching { a.restore() }.onFailure { RingLog.log("Act", "${a.type} restore failed: ${it.message}") }
        }
        if (sessionActive) RingLog.log("Act", "session ended, state restored")
        sessionActive = false
    }
}
