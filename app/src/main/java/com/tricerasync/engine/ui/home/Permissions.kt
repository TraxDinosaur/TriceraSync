// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.home

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.tricerasync.engine.media.TriceraSyncNotificationListener

/** One row of the onboarding checklist (PRD FR-01). */
data class PermissionRow(
    val id: String,
    val title: String,
    val why: String,
    val required: Boolean,
    val granted: Boolean,
    val intent: Intent?,
    val runtimePermission: String? = null,
)

/** Builds the current permission checklist for the device. Re-evaluate on every resume. */
fun permissionRows(context: Context): List<PermissionRow> {
    val pkg = context.packageName
    val nm = context.getSystemService(NotificationManager::class.java)
    val pm = context.getSystemService(PowerManager::class.java)
    return listOf(
        PermissionRow(
            id = "notification_access",
            title = "Notification access",
            why = "Unlocks MediaSessionManager so we can see which YouTube video is playing and its exact position. We never read notification content.",
            required = true,
            granted = TriceraSyncNotificationListener.isEnabled(context),
            intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS),
        ),
        PermissionRow(
            id = "write_settings",
            title = "Modify system settings",
            why = "Brightness cues change the system brightness (the only way to affect the YouTube window).",
            required = false,
            granted = Settings.System.canWrite(context),
            intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:$pkg")),
        ),
        PermissionRow(
            id = "overlay",
            title = "Display over other apps",
            why = "Flash cues draw a full-screen colour overlay above YouTube.",
            required = false,
            granted = Settings.canDrawOverlays(context),
            intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$pkg")),
        ),
        PermissionRow(
            id = "dnd",
            title = "Do Not Disturb access",
            why = "Volume cues would throw a SecurityException while DND is on without this.",
            required = false,
            granted = nm.isNotificationPolicyAccessGranted,
            intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS),
        ),
        PermissionRow(
            id = "post_notifications",
            title = "Post notifications",
            why = "The sync session runs as a foreground service with a small notification.",
            required = false,
            granted = Build.VERSION.SDK_INT < 33 ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
            intent = null,
            runtimePermission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.POST_NOTIFICATIONS else null,
        ),
        PermissionRow(
            id = "battery",
            title = "Ignore battery optimizations",
            why = "Keeps the listener alive so cues keep firing during long videos.",
            required = false,
            granted = pm.isIgnoringBatteryOptimizations(pkg),
            intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$pkg")),
        ),
    )
}
