// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager
import com.tricerasync.engine.core.pcf.Cue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlin.math.roundToInt

/** STREAM_MUSIC volume (what YouTube plays on). Needs DND access only while DND is active. */
class VolumeActuator(
    context: Context,
    private val scope: CoroutineScope,
    private val baselines: BaselineStore,
) : Actuator("volume") {
    private val ctx = context.applicationContext
    private val am = ctx.getSystemService(AudioManager::class.java)
    private val nm = ctx.getSystemService(NotificationManager::class.java)
    private val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)

    private var baseIndex: Int? = null
    private var current: Float? = null
    private var job: Job? = null

    override fun unavailableReason(): String? =
        if (nm.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL &&
            !nm.isNotificationPolicyAccessGranted
        ) "Do Not Disturb is on and DND access is not granted" else null

    override fun onSessionStart() {
        if (baseIndex != null) return
        baseIndex = am.getStreamVolume(AudioManager.STREAM_MUSIC)
        current = baseIndex!!.toFloat() / max
        baselines.volumeIndex = baseIndex
        log("baseline index=$baseIndex/$max")
    }

    /** Puts back a baseline left behind by a previous run that never restored. */
    fun restoreOrphan() {
        val idx = baselines.volumeIndex ?: return
        runCatching { am.setStreamVolume(AudioManager.STREAM_MUSIC, idx, 0) }
            .onSuccess { log("restored orphaned baseline index=$idx") }
            .onFailure { log("orphan restore failed: ${it.message}") }
        baselines.volumeIndex = null
    }

    override fun set(cue: Cue?) {
        if (baseIndex == null) onSessionStart()
        val (target, rampMs) = when (cue) {
            is Cue.Volume -> cue.params.level to cue.params.rampMs
            null -> (baseIndex!!.toFloat() / max) to 0L
            else -> return
        }
        job?.cancel()
        val from = current ?: target
        job = scope.ramp(from, target, rampMs, stepMs = 40) { v -> write(v) }
        log(if (cue == null) "baseline" else "level=$target ramp=${rampMs}ms (${cue.id})")
    }

    override fun cancel() {
        job?.cancel()
        job = null
    }

    override fun restore() {
        cancel()
        val idx = baseIndex ?: return
        runCatching { am.setStreamVolume(AudioManager.STREAM_MUSIC, idx, 0) }
            .onFailure { log("restore failed: ${it.message}") }
        baselines.volumeIndex = null
        log("restored index=$idx")
        baseIndex = null
        current = null
    }

    private fun write(level: Float) {
        current = level
        val idx = (level * max).roundToInt().coerceIn(0, max)
        if (am.getStreamVolume(AudioManager.STREAM_MUSIC) == idx) return
        try {
            am.setStreamVolume(AudioManager.STREAM_MUSIC, idx, 0)
        } catch (e: SecurityException) {
            log("blocked by DND: ${e.message}")
            job?.cancel()
        }
    }
}
