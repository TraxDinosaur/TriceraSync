// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tricerasync.engine.AppGraph
import com.tricerasync.engine.BuildConfig
import com.tricerasync.engine.data.Resolution
import com.tricerasync.engine.media.MediaSessionObserver
import com.tricerasync.engine.ui.theme.FgMuted
import kotlinx.coroutines.launch

/** Base URL, intensity, flash toggle, tick, auto-start, cache + restore tools (PRD FR-27). */
@Composable
fun SettingsScreen() {
    val settings by AppGraph.settings.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(settings.baseUrl) }
    var resolveResult by remember { mutableStateOf<String?>(null) }
    var catalogInfo by remember { mutableStateOf(AppGraph.catalog.summary()) }
    LaunchedEffect(settings.baseUrl) { url = settings.baseUrl }
    val repo = AppGraph.settingsRepo

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("TriceraSync App", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("Base URL (blank = bundled sample sheet)") },
                placeholder = { Text("http://192.168.1.20:3000") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                Button(onClick = { scope.launch { repo.update { it.copy(baseUrl = url) } } }) { Text("Save") }
                OutlinedButton(onClick = {
                    val id = MediaSessionObserver.target.value?.identity
                    if (id == null) {
                        resolveResult = "No YouTube video detected right now."
                        return@OutlinedButton
                    }
                    resolveResult = "Resolving…"
                    scope.launch {
                        resolveResult = when (val r = AppGraph.resolver.resolve(id, forceRefresh = true)) {
                            is Resolution.Resolved -> "${r.response.match.confidence}${if (r.fromCache) " (cache)" else ""} · v${r.response.sheet.meta.sheetVersion} · ${r.response.sheet.playable.size} cues"
                            Resolution.NotFound -> "404 — no sheet for: ${id.rawTitle} (${id.durationMs} ms)"
                            is Resolution.Failed -> "failed: ${r.message}"
                        }
                    }
                }) { Text("Resolve current video") }
            }
            resolveResult?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = FgMuted, modifier = Modifier.padding(top = 6.dp)) }

            Text(
                "Known videos: $catalogInfo",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
                modifier = Modifier.padding(top = 10.dp),
            )
            Text(
                "The app keeps a small list of which videos have a cue sheet, so playing anything " +
                    "else costs no battery and no requests.",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
            )
            OutlinedButton(
                onClick = {
                    catalogInfo = "refreshing…"
                    scope.launch {
                        AppGraph.catalog.refresh(force = true)
                        catalogInfo = AppGraph.catalog.summary()
                    }
                },
                modifier = Modifier.padding(top = 6.dp),
            ) { Text("Refresh list") }
        }

        item {
            Text("Effects", style = MaterialTheme.typography.titleMedium)
            Text("Intensity ${(settings.intensity * 100).toInt()} % — scales vibration amplitude and flash opacity", style = MaterialTheme.typography.bodySmall, color = FgMuted)
            Slider(
                value = settings.intensity,
                onValueChange = { v -> scope.launch { repo.update { it.copy(intensity = v) } } },
                valueRange = 0.25f..1f,
                steps = 2,
            )
            ToggleRow("Flash overlay", "Turn off if you are sensitive to flashing light.", settings.flashEnabled) { v ->
                scope.launch { repo.update { it.copy(flashEnabled = v) } }
            }
            ToggleRow("Auto-start sync", "Start firing cues as soon as a sheet is found; otherwise Home shows a Start button.", settings.autoStart) { v ->
                scope.launch { repo.update { it.copy(autoStart = v) } }
            }
        }

        item {
            Text("Timing", style = MaterialTheme.typography.titleMedium)
            val off = settings.offsetMs
            Text(
                when {
                    off < 0L -> "Cue offset ${off} ms — effects fire ${-off} ms EARLIER"
                    off > 0L -> "Cue offset +${off} ms — effects fire ${off} ms LATER"
                    else -> "Cue offset 0 ms — effects fire exactly on the cue time"
                },
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "If effects feel late, drag left. This compensates for your device: the scheduler " +
                    "tick, how long the motor takes to spin up, and how far YouTube's reported " +
                    "position trails the picture.",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
            )
            Slider(
                value = settings.offsetMs.toFloat(),
                onValueChange = { v ->
                    scope.launch { repo.update { it.copy(offsetMs = (v / 10f).toLong() * 10) } }
                },
                valueRange = -500f..500f,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { scope.launch { repo.update { it.copy(offsetMs = 0) } } }) {
                    Text("Reset to 0")
                }
                Text(
                    "Changes apply to the next video.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FgMuted,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }

            Text(
                "Scheduler tick ${settings.tickMs} ms — how often cue times are checked. Lower is " +
                    "tighter, and only runs while a video is playing.",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
                modifier = Modifier.padding(top = 10.dp),
            )
            Slider(
                value = settings.tickMs.toFloat(),
                onValueChange = { v -> scope.launch { repo.update { it.copy(tickMs = v.toLong()) } } },
                valueRange = 16f..250f,
            )
        }

        item {
            Text("Maintenance", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { AppGraph.actuators.endSession() }) { Text("Restore system state now") }
                OutlinedButton(onClick = {
                    AppGraph.resolver.clear()
                    AppGraph.catalog.clear()
                    catalogInfo = AppGraph.catalog.summary()
                }) { Text("Clear caches") }
            }
            Text(
                "Targets: ${MediaSessionObserver.targetPackages.joinToString()} + any *.android.youtube\nVersion ${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun ToggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = FgMuted)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
