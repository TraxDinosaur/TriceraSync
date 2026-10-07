// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.data

import com.tricerasync.engine.BuildConfig

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("settings")

private val DEFAULT_BASE_URL = BuildConfig.DEFAULT_BASE_URL

/** User settings (PRD FR-10, FR-20, FR-27). */
data class Settings(
    /** TriceraSync App base URL. Blank / default → production cloud API. */
    val baseUrl: String = DEFAULT_BASE_URL,
    val intensity: Float = 1f,
    val flashEnabled: Boolean = true,
    val tickMs: Long = 25,
    /**
     * Fire cues earlier (negative) or later (positive) to compensate for the device. Covers the
     * scheduler tick, actuator latency and however far the media session's reported position
     * trails what is actually on screen.
     */
    val offsetMs: Long = 0,
    /** Start a sync session automatically when a sheet resolves (otherwise Home shows a Start button). */
    val autoStart: Boolean = true,
)

class SettingsRepo(context: Context) {
    private val ds = context.applicationContext.dataStore

    val flow: Flow<Settings> = ds.data.map { p ->
        val rawUrl = p[BASE_URL]
        Settings(
            baseUrl = if (rawUrl.isNullOrBlank()) DEFAULT_BASE_URL else rawUrl,
            intensity = p[INTENSITY] ?: 1f,
            flashEnabled = p[FLASH] ?: true,
            tickMs = p[TICK] ?: 25L,
            offsetMs = p[OFFSET] ?: 0L,
            autoStart = p[AUTO_START] ?: true,
        )
    }

    suspend fun update(block: (Settings) -> Settings) {
        ds.edit { p ->
            val rawUrl = p[BASE_URL]
            val cur = Settings(
                baseUrl = if (rawUrl.isNullOrBlank()) DEFAULT_BASE_URL else rawUrl,
                intensity = p[INTENSITY] ?: 1f,
                flashEnabled = p[FLASH] ?: true,
                tickMs = p[TICK] ?: 25L,
                offsetMs = p[OFFSET] ?: 0L,
                autoStart = p[AUTO_START] ?: true,
            )
            val next = block(cur)
            val savedUrl = next.baseUrl.trim().trimEnd('/')
            p[BASE_URL] = if (savedUrl.isBlank()) DEFAULT_BASE_URL else savedUrl
            p[INTENSITY] = next.intensity.coerceIn(0.25f, 1f)
            p[FLASH] = next.flashEnabled
            p[TICK] = next.tickMs.coerceIn(16L, 250L)
            p[OFFSET] = next.offsetMs.coerceIn(-500L, 500L)
            p[AUTO_START] = next.autoStart
        }
    }

    private companion object {
        val BASE_URL = stringPreferencesKey("base_url")
        val INTENSITY = floatPreferencesKey("intensity")
        val FLASH = booleanPreferencesKey("flash_enabled")
        val TICK = longPreferencesKey("tick_ms")
        val OFFSET = longPreferencesKey("offset_ms")
        val AUTO_START = booleanPreferencesKey("auto_start")
    }
}


