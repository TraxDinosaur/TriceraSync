// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.VibrateParams

/**
 * Shortest "on" time worth sending as a single pulse.
 *
 * A very short pulse is inaudible on a lot of hardware, for two different reasons, so this leans
 * on what the device reports rather than on a list of brands:
 *
 *  - **No amplitude control** almost always means an ERM motor (a spinning weight), which needs
 *    tens of milliseconds just to get moving. LRA motors, which do report amplitude control,
 *    respond far faster.
 *  - **Some vendors drop very short effects outright**, whatever the motor. Motorola and Lenovo
 *    are the ones confirmed on hardware here; the amplitude rule already covers most of the rest.
 *
 * Erring long is the safe direction: a slightly longer buzz is still the cue the creator meant,
 * where a dropped one is nothing at all.
 */
internal fun minPulseFor(manufacturer: String, brand: String, hasAmplitudeControl: Boolean): Long =
    when {
        listOf(manufacturer, brand).any {
            it.equals("motorola", ignoreCase = true) || it.equals("lenovo", ignoreCase = true)
        } -> 45L
        !hasAmplitudeControl -> 40L
        else -> 25L
    }

/**
 * Haptics with a deliberately defensive strategy, because vendor vibrator HALs differ wildly in
 * what they silently ignore:
 *
 *  - **Every vibration carries `USAGE_ALARM` attributes.** With no attributes the request is
 *    `USAGE_UNKNOWN`, and with `USAGE_TOUCH` some vendors (Motorola in particular) drop it
 *    entirely when the app is not the foreground/focused app — which is exactly our situation,
 *    since the viewer is in YouTube. `USAGE_ALARM` is the usage that reliably gets through.
 *  - **Single pulses are expressed as waveforms and floored to a device-appropriate length.**
 *    `createOneShot` and very short effects are ignored by several motors (Motorola's needs
 *    roughly 40 ms before it moves at all); `createWaveform` is honoured.
 *  - **Predefined effects are only used when the device reports them as supported**, and every
 *    capability query and `vibrate()` call is wrapped, since some of them throw rather than
 *    returning a sensible answer.
 */
class VibrateActuator(context: Context) : Actuator("vibrate") {

    private val vibrator: Vibrator? = runCatching {
        if (Build.VERSION.SDK_INT >= 31) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    }.getOrNull()

    private val hasVibrator = runCatching { vibrator?.hasVibrator() == true }.getOrDefault(false)
    private val hasAmplitude = runCatching { vibrator?.hasAmplitudeControl() == true }.getOrDefault(false)

    private val minPulseMs = minPulseFor(Build.MANUFACTURER, Build.BRAND, hasAmplitude)

    private val vibrationAttributes: VibrationAttributes? =
        if (Build.VERSION.SDK_INT >= 33) {
            runCatching { VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM) }.getOrNull()
        } else null

    @Suppress("DEPRECATION")
    private val audioAttributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    override fun unavailableReason(): String? = when {
        vibrator == null -> "no vibrator service"
        !hasVibrator -> "device has no vibrator"
        else -> null
    }

    /** One-line summary for the Test tab so device quirks are visible without a logcat. */
    fun capabilities(): String = buildString {
        append("${Build.MANUFACTURER} ${Build.MODEL} · API ${Build.VERSION.SDK_INT}\n")
        append("vibrator=$hasVibrator amplitude=$hasAmplitude ")
        append("minPulse=${minPulseMs}ms (${if (hasAmplitude) "LRA" else "ERM/unknown"})\n")
        append("usage=ALARM via ${if (vibrationAttributes != null) "VibrationAttributes" else "AudioAttributes"}\n")
        append("predefined: ")
        append(
            PREDEFINED_IDS.entries.joinToString(" ") { (name, id) ->
                "$name=${supportWord(effectSupport(id))}"
            },
        )
    }

    override fun fire(cue: Cue, intensity: Float) {
        val p = (cue as? Cue.Vibrate)?.params ?: return
        if (!hasVibrator) return
        val effect = when (p) {
            is VibrateParams.OneShot -> pulse(p.durationMs, p.amplitude, intensity)
            is VibrateParams.Waveform -> waveform(p, intensity)
            is VibrateParams.Predefined -> predefined(p.effect, intensity)
            is VibrateParams.Unknown -> {
                log("unknown vibrate mode '${p.mode}', skipped")
                return
            }
        } ?: return
        if (vibrateSafely(effect)) log("fired ${p.mode} (${cue.id})")
    }

    override fun cancel() {
        runCatching { vibrator?.cancel() }
    }

    // --- effect construction ------------------------------------------------------------------

    /** A single "on" pulse as a waveform: off 0 ms, then on for `durationMs` (floored). */
    private fun pulse(durationMs: Long, amplitude: Int, intensity: Float): VibrationEffect? {
        val d = durationMs.coerceIn(minPulseMs, 10_000L)
        if (d != durationMs) log("pulse ${durationMs}ms raised to ${d}ms for this motor")
        return runCatching {
            if (hasAmplitude) {
                VibrationEffect.createWaveform(longArrayOf(0, d), intArrayOf(0, amp(amplitude, intensity)), -1)
            } else {
                VibrationEffect.createWaveform(longArrayOf(0, d), -1)
            }
        }.onFailure { log("createWaveform failed: ${it.message}") }.getOrNull()
    }

    /** Two pulses separated by a gap — the fallback for DOUBLE_CLICK. */
    private fun doublePulse(durationMs: Long, gapMs: Long, intensity: Float): VibrationEffect? {
        val d = durationMs.coerceAtLeast(minPulseMs)
        return runCatching {
            if (hasAmplitude) {
                val a = amp(255, intensity)
                VibrationEffect.createWaveform(longArrayOf(0, d, gapMs, d), intArrayOf(0, a, 0, a), -1)
            } else {
                VibrationEffect.createWaveform(longArrayOf(0, d, gapMs, d), -1)
            }
        }.getOrNull()
    }

    private fun waveform(p: VibrateParams.Waveform, intensity: Float): VibrationEffect? {
        if (p.timings.isEmpty()) return null
        val timings = p.timings.toLongArray()
        return runCatching {
            if (hasAmplitude && p.amplitudes.size == p.timings.size) {
                val amps = IntArray(p.amplitudes.size) { i -> amp(p.amplitudes[i], intensity) }
                VibrationEffect.createWaveform(timings, amps, p.repeat)
            } else {
                VibrationEffect.createWaveform(timings, p.repeat)
            }
        }.onFailure { log("createWaveform failed: ${it.message}") }.getOrNull()
    }

    private fun predefined(effect: String, intensity: Float): VibrationEffect? {
        val id = PREDEFINED_IDS[effect] ?: VibrationEffect.EFFECT_CLICK
        if (effectSupport(id) == Vibrator.VIBRATION_EFFECT_SUPPORT_YES) {
            runCatching { VibrationEffect.createPredefined(id) }
                .onFailure { log("createPredefined($effect) failed: ${it.message}") }
                .getOrNull()
                ?.let { return it }
        }
        // Approximate with pulses long enough for a stubborn motor.
        return when (effect) {
            "DOUBLE_CLICK" -> doublePulse(minPulseMs, 60, intensity)
            "TICK" -> pulse(minPulseMs, 180, intensity)
            "HEAVY_CLICK" -> pulse(minPulseMs + 25, 255, intensity)
            else -> pulse(minPulseMs + 10, 255, intensity)
        }
    }

    private fun amp(value: Int, intensity: Float): Int {
        if (value <= 0) return 0
        return (value * intensity).toInt().coerceIn(1, 255)
    }

    // --- capability queries (defensive: some HALs throw) ---------------------------------------

    private fun effectSupport(id: Int): Int {
        val v = vibrator ?: return Vibrator.VIBRATION_EFFECT_SUPPORT_NO
        if (Build.VERSION.SDK_INT < 30) {
            // Not queryable before API 30; API 29 has createPredefined, older has nothing.
            return if (Build.VERSION.SDK_INT == 29) Vibrator.VIBRATION_EFFECT_SUPPORT_UNKNOWN
            else Vibrator.VIBRATION_EFFECT_SUPPORT_NO
        }
        return runCatching { v.areEffectsSupported(id).firstOrNull() }
            .getOrNull() ?: Vibrator.VIBRATION_EFFECT_SUPPORT_UNKNOWN
    }

    private fun supportWord(support: Int) = when (support) {
        Vibrator.VIBRATION_EFFECT_SUPPORT_YES -> "yes"
        Vibrator.VIBRATION_EFFECT_SUPPORT_NO -> "no"
        else -> "unknown"
    }

    /** Every vibrate() goes through here: alarm usage + never let a vendor HAL crash a cue. */
    private fun vibrateSafely(effect: VibrationEffect): Boolean {
        val v = vibrator ?: return false
        return runCatching {
            if (Build.VERSION.SDK_INT >= 33 && vibrationAttributes != null) {
                v.vibrate(effect, vibrationAttributes)
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(effect, audioAttributes)
            }
            true
        }.onFailure { log("vibrate failed: ${it.message}") }.getOrDefault(false)
    }

    private companion object {
        val PREDEFINED_IDS = linkedMapOf(
            "CLICK" to VibrationEffect.EFFECT_CLICK,
            "DOUBLE_CLICK" to VibrationEffect.EFFECT_DOUBLE_CLICK,
            "HEAVY_CLICK" to VibrationEffect.EFFECT_HEAVY_CLICK,
            "TICK" to VibrationEffect.EFFECT_TICK,
        )
    }
}
