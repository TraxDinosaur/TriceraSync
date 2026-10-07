// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tricerasync.engine.sync.CoordinatorUi
import com.tricerasync.engine.sync.SyncCoordinator
import com.tricerasync.engine.sync.SyncStatus
import com.tricerasync.engine.ui.theme.Accent
import com.tricerasync.engine.ui.theme.CueBrightness
import com.tricerasync.engine.ui.theme.CueFlash
import com.tricerasync.engine.ui.theme.CueTorch
import com.tricerasync.engine.ui.theme.CueVibrate
import com.tricerasync.engine.ui.theme.CueVolume
import com.tricerasync.engine.ui.theme.Danger
import com.tricerasync.engine.ui.theme.FgMuted
import com.tricerasync.engine.ui.theme.Success
import com.tricerasync.engine.ui.theme.Warning

/** Live status: listening → detected → resolving → synced, with position and recent cues (FR-25). */
@Composable
fun StatusCard(ui: CoordinatorUi) {
    val (label, color) = when (ui.status) {
        SyncStatus.NOT_LISTENING -> "Not listening — grant Notification access" to Warning
        SyncStatus.LISTENING -> "Listening for YouTube…" to Accent
        SyncStatus.RESOLVING -> "Looking up cue sheet…" to Accent
        SyncStatus.NO_SHEET -> "No TriceraSync for this video" to FgMuted
        SyncStatus.READY -> "Sheet found — ready" to Success
        SyncStatus.SYNCED -> (if (ui.simulating) "Simulating" else "Synced") to Success
        SyncStatus.ERROR -> "Resolve failed" to Danger
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Spacer(Modifier.size(10.dp).background(color, CircleShape))
                Text(label, style = MaterialTheme.typography.titleMedium)
            }
            val id = ui.identity
            if (id != null) {
                Text(id.rawTitle, style = MaterialTheme.typography.bodyLarge)
                Text(
                    listOfNotNull(id.rawChannel, formatMs(id.durationMs), ui.confidence?.let { "match: $it" }, if (ui.fromCache) "cache" else null, ui.message)
                        .joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = FgMuted,
                )
            } else {
                Text(
                    ui.message ?: "Open YouTube and play a video that has a TriceraSync sheet.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FgMuted,
                )
            }
            val s = ui.session
            if (s != null) {
                Text(
                    "${formatMs(s.positionMs)}  ${if (s.playing) "▶" else "❚❚"}   cues ${s.cueCount} · fired ${s.fired.size} · seeks ${s.seeks} · drift ${s.drift}",
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                )
                s.fired.asReversed().take(8).forEach { f ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Spacer(Modifier.size(8.dp).background(cueColor(f.type), CircleShape))
                        Text(
                            "${f.type.padEnd(10)} @${formatMs(f.at)}  +${f.lateMs} ms",
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            color = if (f.lateMs > 120) Warning else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                if (ui.status == SyncStatus.READY) {
                    Button(onClick = { SyncCoordinator.startSession() }) { Text("Start sync") }
                }
                if (ui.status == SyncStatus.SYNCED) {
                    OutlinedButton(onClick = { if (ui.simulating) SyncCoordinator.stopSimulation() else SyncCoordinator.userStop() }) { Text("Stop") }
                }
                if (ui.status == SyncStatus.ERROR || ui.status == SyncStatus.NO_SHEET) {
                    OutlinedButton(onClick = { SyncCoordinator.retry() }) { Text("Try again") }
                }
            }
        }
    }
}

fun cueColor(type: String) = when (type) {
    "vibrate" -> CueVibrate
    "brightness" -> CueBrightness
    "volume" -> CueVolume
    "flash" -> CueFlash
    "torch" -> CueTorch
    else -> FgMuted
}
