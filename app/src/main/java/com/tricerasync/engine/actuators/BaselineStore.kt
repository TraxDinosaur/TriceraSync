// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import android.content.Context
import android.content.SharedPreferences

/**
 * Remembers the system values a session changed, so they can still be put back if the process
 * never gets to run `restore()` — force-stop, low-memory kill, or a reboot mid-video.
 *
 * SharedPreferences (not DataStore) on purpose: writes must be synchronous and callable from
 * anywhere, including `Service.onDestroy`.
 */
class BaselineStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("baselines", Context.MODE_PRIVATE)

    var brightness: Pair<Int, Int>?
        get() {
            if (!prefs.contains(KEY_BRIGHTNESS_LEVEL)) return null
            return prefs.getInt(KEY_BRIGHTNESS_MODE, 1) to prefs.getInt(KEY_BRIGHTNESS_LEVEL, 0)
        }
        set(value) {
            prefs.edit().apply {
                if (value == null) {
                    remove(KEY_BRIGHTNESS_MODE).remove(KEY_BRIGHTNESS_LEVEL)
                } else {
                    putInt(KEY_BRIGHTNESS_MODE, value.first).putInt(KEY_BRIGHTNESS_LEVEL, value.second)
                }
            }.commit()
        }

    var volumeIndex: Int?
        get() = if (prefs.contains(KEY_VOLUME)) prefs.getInt(KEY_VOLUME, 0) else null
        set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_VOLUME) else putInt(KEY_VOLUME, value)
            }.commit()
        }

    /** True when a previous run changed something and never restored it. */
    val hasOrphan: Boolean get() = brightness != null || volumeIndex != null

    private companion object {
        const val KEY_BRIGHTNESS_MODE = "brightness_mode"
        const val KEY_BRIGHTNESS_LEVEL = "brightness_level"
        const val KEY_VOLUME = "volume_index"
    }
}
