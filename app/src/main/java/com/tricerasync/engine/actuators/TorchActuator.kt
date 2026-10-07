// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import com.tricerasync.engine.core.pcf.Cue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Camera torch via CameraManager.setTorchMode — no CAMERA permission needed. */
class TorchActuator(context: Context, private val scope: CoroutineScope) : Actuator("torch") {
    private val cm = context.applicationContext.getSystemService(CameraManager::class.java)
    private val cameraId: String? = runCatching {
        cm.cameraIdList.firstOrNull { id ->
            val c = cm.getCameraCharacteristics(id)
            c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true &&
                c.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: cm.cameraIdList.firstOrNull { id ->
            cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        }
    }.getOrNull()
    private val maxStrength: Int = cameraId?.let { id ->
        if (Build.VERSION.SDK_INT >= 33) {
            runCatching { cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_STRENGTH_MAXIMUM_LEVEL) ?: 1 }.getOrDefault(1)
        } else 1
    } ?: 1

    private var on = false
    private var offJob: Job? = null

    override fun unavailableReason(): String? = if (cameraId == null) "no camera flash" else null

    override fun set(cue: Cue?) {
        val id = cameraId ?: return
        offJob?.cancel()
        val p = (cue as? Cue.Torch)?.params
        if (p == null || !p.on) {
            turn(id, false)
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= 33 && maxStrength > 1 && p.strength < 1f) {
                cm.turnOnTorchWithStrengthLevel(id, (p.strength * maxStrength).roundToInt().coerceIn(1, maxStrength))
            } else {
                cm.setTorchMode(id, true)
            }
            on = true
            log("on strength=${p.strength} (${cue.id})")
        } catch (e: Exception) {
            log("torch on failed: ${e.message}")
            return
        }
        p.durationMs?.let { ms ->
            offJob = scope.launch {
                delay(ms)
                turn(id, false)
            }
        }
    }

    override fun cancel() {
        offJob?.cancel()
        offJob = null
        cameraId?.let { turn(it, false) }
    }

    override fun restore() = cancel()

    private fun turn(id: String, enabled: Boolean) {
        if (on == enabled) return
        runCatching { cm.setTorchMode(id, enabled) }
            .onSuccess { on = enabled; if (!enabled) log("off") }
            .onFailure { log("setTorchMode($enabled) failed: ${it.message}") }
    }
}
