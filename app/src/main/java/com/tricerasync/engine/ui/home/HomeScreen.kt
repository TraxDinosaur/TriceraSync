// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.home

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tricerasync.engine.media.MediaSessionObserver
import com.tricerasync.engine.sync.SyncCoordinator
import com.tricerasync.engine.sync.SyncStatus
import com.tricerasync.engine.ui.theme.Accent
import com.tricerasync.engine.ui.theme.LogoMark
import com.tricerasync.engine.ui.theme.BgElev
import com.tricerasync.engine.ui.theme.BgElev2
import com.tricerasync.engine.ui.theme.Fg
import com.tricerasync.engine.ui.theme.FgMuted
import com.tricerasync.engine.ui.theme.Success
import com.tricerasync.engine.ui.theme.Warning

/** Clean, minimal home screen for end users (PRD demo flow). */
@Composable
fun HomeScreen() {
    val context = LocalContext.current
    var rows by remember { mutableStateOf(permissionRows(context)) }
    var viewPermissions by remember { mutableStateOf(false) }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                rows = permissionRows(context)
                if (rows.first().granted) MediaSessionObserver.start(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val runtimeLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        rows = permissionRows(context)
    }

    val ui by SyncCoordinator.ui.collectAsStateWithLifecycle()
    val notificationGranted = rows.firstOrNull { it.id == "notification_access" }?.granted == true
    val missing = rows.count { !it.granted }
    val allGranted = missing == 0

    // Show setup screen if required permission missing or user explicitly taps Manage
    if (!notificationGranted || (missing > 0 && !viewPermissions)) {
        PermissionSetupView(
            rows = rows,
            onGrant = { row ->
                if (row.runtimePermission != null) runtimeLauncher.launch(row.runtimePermission)
                else row.intent?.let { context.startActivitySafely(it) }
            },
            onContinue = { viewPermissions = true },
            canContinue = notificationGranted,
        )
    } else {
        ReadyView(
            ui = ui,
            onManagePermissions = { viewPermissions = false },
        )
    }
}

/** Shown when permissions are needed. */
@Composable
private fun PermissionSetupView(
    rows: List<PermissionRow>,
    onGrant: (PermissionRow) -> Unit,
    onContinue: () -> Unit,
    canContinue: Boolean,
) {
    LazyColumn(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(Modifier.padding(top = 8.dp, bottom = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LogoMark(size = 44.dp)
                    Spacer(Modifier.size(12.dp))
                    Column {
                        Text(
                            "TriceraSync",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Fg,
                        )
                        Text(
                            "Feel the video",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Accent,
                        )
                    }
                }
                Spacer(Modifier.height(18.dp))
                Text(
                    "Grant the permissions below to enable haptic and visual effects. Each one powers a single kind of effect, and anything you skip is simply skipped.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = FgMuted,
                )
            }
        }

        items(rows, key = { it.id }) { row ->
            PermissionCard(row) { onGrant(row) }
        }

        if (canContinue) {
            item {
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onContinue,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text("Continue", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

/** Shown once permissions are in place. Minimal, distraction-free. */
@Composable
private fun ReadyView(
    ui: com.tricerasync.engine.sync.CoordinatorUi,
    onManagePermissions: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth(),
        ) {
            // Icon
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Success.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Ready",
                    tint = Success,
                    modifier = Modifier.size(44.dp),
                )
            }

            Spacer(Modifier.height(24.dp))

            Text(
                "All Set!",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Fg,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(10.dp))

            Text(
                "Open YouTube and play your video.",
                style = MaterialTheme.typography.titleMedium,
                color = Accent,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "Haptics and screen effects will synchronize automatically in the background.",
                style = MaterialTheme.typography.bodyMedium,
                color = FgMuted,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(32.dp))

            // Active sync status card
            if (ui.status == SyncStatus.SYNCED && ui.identity != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgElev),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Spacer(
                            Modifier
                                .size(12.dp)
                                .background(Success, CircleShape)
                        )
                        Column(Modifier.weight(1f)) {
                            Text(
                                "Syncing with YouTube",
                                style = MaterialTheme.typography.labelSmall,
                                color = Success,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                ui.identity.rawTitle,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                            )
                        }
                    }
                }
            } else if (ui.status == SyncStatus.RESOLVING) {
                Text(
                    "Matching video with TriceraSync…",
                    style = MaterialTheme.typography.bodySmall,
                    color = Accent,
                )
            }
        }

        // Bottom quiet link for permissions
        TextButton(
            onClick = onManagePermissions,
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Text(
                "Permissions ✓",
                style = MaterialTheme.typography.labelSmall,
                color = FgMuted,
            )
        }
    }
}

@Composable
private fun PermissionCard(row: PermissionRow, onGrant: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = BgElev2),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(
                Modifier.size(10.dp).background(
                    if (row.granted) Success else if (row.required) Warning else FgMuted,
                    CircleShape,
                )
            )
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(
                    row.title + if (row.required) " (Required)" else "",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                Text(row.why, style = MaterialTheme.typography.bodySmall, color = FgMuted)
            }
            if (row.granted) {
                Text("Granted ✓", color = Success, style = MaterialTheme.typography.labelMedium)
            } else if (row.intent != null || row.runtimePermission != null) {
                Button(onClick = onGrant) { Text("Grant") }
            } else {
                TextButton(onClick = {}, enabled = false) { Text("n/a") }
            }
        }
    }
}

fun formatMs(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

fun Context.startActivitySafely(intent: android.content.Intent) {
    try {
        startActivity(intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
        startActivity(
            android.content.Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.parse("package:$packageName"),
            ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
