// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import android.content.res.Resources
import android.provider.Settings
import com.tricerasync.engine.core.pcf.Cue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlin.math.roundToInt

/**
 * System-wide screen brightness via Settings.System (needs WRITE_SETTINGS). A window-level
 * brightness would only affect our own window, so this is the only way to dim YouTube.
 * Baseline (mode + level) is captured per session and restored on end.
 */
class BrightnessActuator(
    context: Context,
    private val scope: CoroutineScope,
    private val baselines: BaselineStore,
) : Actuator("brightness") {
    private val ctx = context.applicationContext
    private val cr = ctx.contentResolver
    private val max = detectMax()
    private val floor = (max * 0.02f).roundToInt().coerceAtLeast(1)

    private var baseMode: Int? = null
    private var baseLevel: Int? = null
    private var current: Float? = null
    private var job: Job? = null

    override fun unavailableReason(): String? =
        if (!Settings.System.canWrite(ctx)) "WRITE_SETTINGS not granted" else null

    override fun onSessionStart() {
        if (baseMode != null) return
        baseMode = Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        baseLevel = Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS, max / 2)
        current = baseLevel!!.toFloat() / max
        // Persist so a force-stop / reboot can still undo the change on next launch.
        baselines.brightness = baseMode!! to baseLevel!!
        log("baseline mode=$baseMode level=$baseLevel/$max")
    }

    /** Puts back a baseline left behind by a previous run that never restored (crash / reboot). */
    fun restoreOrphan() {
        val (mode, level) = baselines.brightness ?: return
        if (unavailableReason() != null) return
        runCatching {
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, level)
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, mode)
        }.onSuccess { log("restored orphaned baseline mode=$mode level=$level") }
            .onFailure { log("orphan restore failed: ${it.message}") }
        baselines.brightness = null
    }

    override fun set(cue: Cue?) {
        if (unavailableReason() != null) return
        if (baseMode == null) onSessionStart()
        val (target, rampMs) = when (cue) {
            is Cue.Brightness -> cue.params.level to cue.params.rampMs
            null -> (baseLevel!!.toFloat() / max) to 0L
            else -> return
        }
        // Adaptive brightness would fight us; switch to manual for the session (PRD A5).
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        job?.cancel()
        val from = current ?: target
        job = scope.ramp(from, target, rampMs) { v -> write(v) }
        log(if (cue == null) "baseline (ramp ${rampMs}ms)" else "level=$target ramp=${rampMs}ms (${cue.id})")
    }

    override fun cancel() {
        job?.cancel()
        job = null
    }

    override fun restore() {
        cancel()
        val mode = baseMode ?: return
        val level = baseLevel ?: return
        runCatching {
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, level)
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, mode)
        }.onFailure { log("restore failed: ${it.message}") }
        baselines.brightness = null
        log("restored mode=$mode level=$level")
        baseMode = null
        baseLevel = null
        current = null
    }

    private fun write(level: Float) {
        current = level
        val raw = (level * max).roundToInt().coerceIn(floor, max)
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, raw)
    }

    /** OEMs differ (255 on stock, 4095 on some Xiaomi); the framework config resource knows. */
    private fun detectMax(): Int {
        val res = Resources.getSystem()
        val id = res.getIdentifier("config_screenBrightnessSettingMaximum", "integer", "android")
        val v = if (id != 0) runCatching { res.getInteger(id) }.getOrDefault(255) else 255
        val currentRaw = runCatching { Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS) }.getOrDefault(0)
        return maxOf(v, currentRaw, 255)
    }
}
