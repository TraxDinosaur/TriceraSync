// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine

import android.content.Context
import com.tricerasync.engine.actuators.ActuatorRegistry
import com.tricerasync.engine.data.CatalogRepo
import com.tricerasync.engine.data.CueResolver
import com.tricerasync.engine.data.FakeTriceraSyncApi
import com.tricerasync.engine.data.HttpTriceraSyncApi
import com.tricerasync.engine.data.TriceraSyncApi
import com.tricerasync.engine.data.Settings
import com.tricerasync.engine.data.SettingsRepo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Manual dependency graph (demo scope — Hilt later if it grows). */
object AppGraph {
    lateinit var actuators: ActuatorRegistry
        private set
    lateinit var settingsRepo: SettingsRepo
        private set
    lateinit var resolver: CueResolver
        private set
    lateinit var catalog: CatalogRepo
        private set

    private val _settings = MutableStateFlow(Settings())
    /** Latest settings snapshot for non-suspending readers. */
    val settings: StateFlow<Settings> = _settings

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    fun init(context: Context) {
        if (::actuators.isInitialized) return
        val ctx = context.applicationContext
        actuators = ActuatorRegistry(ctx)
        settingsRepo = SettingsRepo(ctx)
        val http = HttpTriceraSyncApi { _settings.value.baseUrl }
        val fake = FakeTriceraSyncApi(ctx)
        val api: () -> TriceraSyncApi = { if (_settings.value.baseUrl.isBlank()) fake else http }
        resolver = CueResolver(ctx, api)
        catalog = CatalogRepo(ctx) { _settings.value.baseUrl }
        scope.launch {
            var lastBaseUrl: String? = null
            settingsRepo.flow.collect { s ->
                _settings.value = s
                actuators.intensity = s.intensity
                actuators.flashEnabled = s.flashEnabled
                // Refresh the catalogue on startup and whenever the server changes.
                if (s.baseUrl != lastBaseUrl) {
                    lastBaseUrl = s.baseUrl
                    catalog.refresh(force = true)
                } else if (catalog.isStale) {
                    catalog.refresh()
                }
            }
        }
    }
}
