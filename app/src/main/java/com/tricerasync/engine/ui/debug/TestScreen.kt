// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.debug

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tricerasync.engine.AppGraph
import com.tricerasync.engine.sync.SyncCoordinator
import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.FlashParams
import com.tricerasync.engine.core.pcf.LevelParams
import com.tricerasync.engine.core.pcf.TorchParams
import com.tricerasync.engine.core.pcf.VibrateParams
import com.tricerasync.engine.ui.theme.BgElev2
import com.tricerasync.engine.ui.theme.Danger
import com.tricerasync.engine.ui.theme.FgMuted
import com.tricerasync.engine.ui.theme.Success
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Manual actuator bench (PRD FR-26): fire each effect with sample params, then restore. */
@Composable
fun TestScreen() {
    val reg = AppGraph.actuators
    var tick by remember { mutableIntStateOf(0) } // re-read availability after actions
    val bump = { tick++ }
    val heartbeat = VibrateParams.Waveform(timings = listOf(0, 80, 90, 110), amplitudes = listOf(0, 200, 0, 255))

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Actuator bench", style = MaterialTheme.typography.titleMedium)
            Text(
                "Baselines are captured on the first effect and restored with the button below. " +
                    "Switch to YouTube and come back to see effects over another app.",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
            )
        }
        item {
            @Suppress("UNUSED_EXPRESSION") tick
            Card(colors = CardDefaults.cardColors(containerColor = BgElev2), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    reg.all.forEach { a ->
                        val reason = a.unavailableReason()
                        Text(
                            "${a.type}: ${reason ?: "ready"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (reason == null) Success else Danger,
                        )
                    }
                    Text("session ${if (reg.sessionActive) "active" else "idle"}", style = MaterialTheme.typography.bodySmall, color = FgMuted)
                    Text(
                        reg.vibrate.capabilities(),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        color = FgMuted,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }
        item {
            Section("Vibrate") {
                Btn("One-shot 200") { reg.fire(Cue.Vibrate("t_v1", 0, params = VibrateParams.OneShot(durationMs = 200))); bump() }
                Btn("Heartbeat") { reg.fire(Cue.Vibrate("t_v2", 0, params = heartbeat)); bump() }
                Btn("Heavy click") { reg.fire(Cue.Vibrate("t_v3", 0, params = VibrateParams.Predefined(effect = "HEAVY_CLICK"))); bump() }
            }
        }
        item {
            Section("Brightness (system-wide)") {
                Btn("20 % · 300 ms ramp") { reg.startSession(); reg.setState("brightness", Cue.Brightness("t_b1", 0, params = LevelParams(0.2f, 300))); bump() }
                Btn("100 %") { reg.startSession(); reg.setState("brightness", Cue.Brightness("t_b2", 0, params = LevelParams(1f, 0))); bump() }
                Btn("Baseline") { reg.setState("brightness", null); bump() }
            }
        }
        item {
            Section("Volume (media)") {
                Btn("30 % · 300 ms") { reg.startSession(); reg.setState("volume", Cue.Volume("t_vo1", 0, params = LevelParams(0.3f, 300))); bump() }
                Btn("100 %") { reg.startSession(); reg.setState("volume", Cue.Volume("t_vo2", 0, params = LevelParams(1f, 300))); bump() }
                Btn("Baseline") { reg.setState("volume", null); bump() }
            }
        }
        item {
            Section("Flash (overlay)") {
                Btn("Red 120 ms + fade") { reg.startSession(); reg.fire(Cue.Flash("t_f1", 0, params = FlashParams("#FF3B00", 0.7f, 120, 260))); bump() }
                Btn("White 60 ms") { reg.startSession(); reg.fire(Cue.Flash("t_f2", 0, params = FlashParams("#FFFFFF", 0.9f, 60, 0))); bump() }
                Btn("Delayed 3 s") {
                    reg.startSession()
                    reg.scope.launch {
                        delay(3000)
                        reg.fire(Cue.Flash("t_f3", 0, params = FlashParams("#00A3FF", 0.7f, 150, 300)))
                    }
                    bump()
                }
            }
        }
        item {
            Section("Torch") {
                Btn("150 ms") { reg.setState("torch", Cue.Torch("t_t1", 0, params = TorchParams(true, 150))); bump() }
                Btn("On 2 s") { reg.setState("torch", Cue.Torch("t_t2", 0, params = TorchParams(true, 2000))); bump() }
                Btn("Off") { reg.setState("torch", null); bump() }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { reg.endSession(); bump() }) { Text("Restore all & end session") }
                OutlinedButton(onClick = { reg.cancelAll(); bump() }) { Text("Cancel timed") }
            }
        }
        item {
            val ctx = androidx.compose.ui.platform.LocalContext.current
            Text("Simulate the bundled sample sheet (no YouTube needed)", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            Text(
                "Runs the full pipeline — scheduler, actuators, foreground notification — against a fake clock-driven playback. Watch Home for position and fired cues.",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                Button(onClick = {
                    val sheet = com.tricerasync.engine.core.pcf.PcfParser.parseSheet(ctx.assets.open("sample-sheet.json").bufferedReader().readText())
                    SyncCoordinator.startSimulation(sheet)
                    bump()
                }) { Text("Play") }
                OutlinedButton(onClick = { SyncCoordinator.simulate(android.media.session.PlaybackState.STATE_PAUSED, SyncCoordinator.simulatedPosition()); bump() }) { Text("Pause") }
                OutlinedButton(onClick = { SyncCoordinator.simulate(android.media.session.PlaybackState.STATE_PLAYING, SyncCoordinator.simulatedPosition()); bump() }) { Text("Resume") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                OutlinedButton(onClick = { SyncCoordinator.simulate(android.media.session.PlaybackState.STATE_PLAYING, SyncCoordinator.simulatedPosition() + 10_000); bump() }) { Text("+10 s") }
                OutlinedButton(onClick = { SyncCoordinator.simulate(android.media.session.PlaybackState.STATE_PLAYING, (SyncCoordinator.simulatedPosition() - 10_000).coerceAtLeast(0)); bump() }) { Text("−10 s") }
                OutlinedButton(onClick = { SyncCoordinator.simulate(android.media.session.PlaybackState.STATE_PLAYING, SyncCoordinator.simulatedPosition(), 2f); bump() }) { Text("2×") }
                OutlinedButton(onClick = { SyncCoordinator.stopSimulation(); bump() }) { Text("Stop") }
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = FgMuted)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) { content() }
    }
}

@Composable
private fun Btn(label: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) { Text(label, style = MaterialTheme.typography.labelMedium) }
}
