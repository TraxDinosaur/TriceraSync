// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.debug

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tricerasync.engine.media.MediaSessionObserver
import com.tricerasync.engine.media.SessionDump
import com.tricerasync.engine.ui.home.formatMs
import com.tricerasync.engine.ui.theme.Accent
import com.tricerasync.engine.ui.theme.BgElev2
import com.tricerasync.engine.ui.theme.FgMuted
import com.tricerasync.engine.ui.theme.Success
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Raw MediaSession dump (PRD FR-26, Phase 1 spike). The computed position refreshes every
 * 100 ms so you can compare it with YouTube's seekbar by eye.
 */
@Composable
fun DumpScreen() {
    val context = LocalContext.current
    val sessions by MediaSessionObserver.sessions.collectAsStateWithLifecycle()
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = SystemClock.elapsedRealtime()
            delay(100)
        }
    }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { MediaSessionObserver.refresh() }) { Text("Refresh") }
                Button(onClick = { copy(context, dumpJson(sessions, now)) }) { Text("Copy JSON") }
            }
            Text(
                if (sessions.isEmpty()) "No active media sessions. Play something in YouTube."
                else "${sessions.size} session(s) · target = ${MediaSessionObserver.targetPackages.joinToString()}",
                style = MaterialTheme.typography.bodySmall,
                color = FgMuted,
            )
        }
        items(sessions, key = { it.packageName + it.title }) { s -> SessionCard(s, now) }
    }
}

@Composable
private fun SessionCard(s: SessionDump, now: Long) {
    Card(
        colors = CardDefaults.cardColors(containerColor = BgElev2),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                s.packageName + if (s.isTarget) "  · TARGET" else "",
                style = MaterialTheme.typography.labelLarge,
                color = if (s.isTarget) Accent else FgMuted,
            )
            Text(s.title ?: "(no title)", style = MaterialTheme.typography.titleMedium)
            Text("${s.artist ?: "—"}  ·  ${s.album ?: "—"}", style = MaterialTheme.typography.bodySmall, color = FgMuted)

            val snap = s.snapshot
            val pos = snap?.positionAt(now)
            Mono("state       ${snap?.stateName ?: "—"}")
            Mono("position    ${pos?.let { "${formatMs(it)}  ($it ms)" } ?: "—"}", color = if (snap?.isPlaying == true) Success else null)
            Mono("raw pos     ${snap?.positionMs ?: "—"} ms   speed ${snap?.speed ?: "—"}")
            Mono("updatedAt   ${snap?.updatedAt ?: "—"}   age ${snap?.let { now - it.updatedAt } ?: "—"} ms")
            Mono("duration    ${s.durationMs?.let { "${formatMs(it)}  ($it ms)" } ?: "MISSING"}")
            Mono("mediaId     ${s.mediaId ?: "—"}")
            Mono("events      ${s.eventCount}")
            Text("metadata keys", style = MaterialTheme.typography.labelMedium, color = FgMuted, modifier = Modifier.padding(top = 6.dp))
            s.metadata.forEach { (k, v) -> Mono("$k = $v") }
        }
    }
}

@Composable
private fun Mono(text: String, color: androidx.compose.ui.graphics.Color? = null) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        fontFamily = FontFamily.Monospace,
        color = color ?: MaterialTheme.colorScheme.onSurface,
    )
}

private fun dumpJson(sessions: List<SessionDump>, now: Long): String {
    val arr = buildJsonArray {
        for (s in sessions) {
            add(
                buildJsonObject {
                    put("package", s.packageName)
                    put("target", s.isTarget)
                    put("title", s.title)
                    put("artist", s.artist)
                    put("album", s.album)
                    put("durationMs", s.durationMs)
                    put("mediaId", s.mediaId)
                    s.snapshot?.let { snap ->
                        put("state", snap.stateName)
                        put("positionMs", snap.positionMs)
                        put("computedPositionMs", snap.positionAt(now))
                        put("speed", snap.speed)
                        put("lastPositionUpdateTime", snap.updatedAt)
                        put("ageMs", now - snap.updatedAt)
                        put("actions", snap.actions)
                    }
                    put("metadata", buildJsonObject { s.metadata.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
                },
            )
        }
    }
    return Json { prettyPrint = true }.encodeToString(kotlinx.serialization.json.JsonArray.serializer(), arr)
}

private fun copy(context: Context, text: String) {
    val cm = context.getSystemService(ClipboardManager::class.java)
    cm.setPrimaryClip(ClipData.newPlainText("TriceraSync MediaSession dump", text))
}
