// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import com.tricerasync.engine.core.pcf.Cue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Full-screen colour flash drawn above YouTube through a persistent (alpha 0) overlay window
 * (needs SYSTEM_ALERT_WINDOW). Adding/removing the window per cue costs 30–80 ms, so the view
 * stays attached for the whole session and only its colour/alpha changes.
 */
class FlashOverlayActuator(context: Context, private val scope: CoroutineScope) : Actuator("flash") {
    private val ctx = context.applicationContext
    private val wm = ctx.getSystemService(WindowManager::class.java)
    private var view: View? = null
    private var job: Job? = null
    private val recentFlashes = ArrayDeque<Long>()

    override fun unavailableReason(): String? =
        if (!Settings.canDrawOverlays(ctx)) "overlay permission not granted" else null

    override fun onSessionStart() = attach()

    override fun fire(cue: Cue, intensity: Float) {
        val p = (cue as? Cue.Flash)?.params ?: return
        if (unavailableReason() != null) return
        if (view == null) attach()
        val v = view ?: return

        // Photosensitivity guard: at most 3 flashes per rolling second (PRD NFR Safety).
        val now = System.currentTimeMillis()
        while (recentFlashes.isNotEmpty() && now - recentFlashes.first() > 1000) recentFlashes.removeFirst()
        if (recentFlashes.size >= MAX_PER_SECOND) {
            log("rate-limited (${cue.id})")
            return
        }
        recentFlashes.addLast(now)

        val color = runCatching { Color.parseColor(p.color) }.getOrDefault(Color.RED)
        val alpha = (p.opacity * intensity).coerceIn(0f, 1f)
        job?.cancel()
        v.animate().cancel()
        v.setBackgroundColor(color)
        v.alpha = alpha
        job = scope.launch {
            delay(p.durationMs)
            if (p.fadeOutMs > 0) v.animate().alpha(0f).setDuration(p.fadeOutMs).start()
            else v.alpha = 0f
        }
        log("fired ${p.color} α=$alpha hold=${p.durationMs} fade=${p.fadeOutMs} (${cue.id})")
    }

    override fun cancel() {
        job?.cancel()
        job = null
        view?.let {
            it.animate().cancel()
            it.alpha = 0f
        }
    }

    override fun restore() {
        cancel()
        detach()
    }

    private fun attach() {
        if (view != null || !Settings.canDrawOverlays(ctx)) return
        val v = View(ctx).apply {
            alpha = 0f
            setBackgroundColor(Color.RED)
        }
        val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START }
        runCatching { wm.addView(v, lp) }
            .onSuccess { view = v; log("overlay attached") }
            .onFailure { log("overlay attach failed: ${it.message}") }
    }

    private fun detach() {
        view?.let { runCatching { wm.removeViewImmediate(it) } }
        view = null
    }

    private companion object {
        const val MAX_PER_SECOND = 3
    }
}
