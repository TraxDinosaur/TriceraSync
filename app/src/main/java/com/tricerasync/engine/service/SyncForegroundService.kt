// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.tricerasync.engine.AppGraph
import com.tricerasync.engine.R
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.sync.SyncCoordinator
import com.tricerasync.engine.ui.MainActivity

/**
 * Foreground service that exists while a sync session runs (PRD FR-21). The session itself is
 * owned by SyncCoordinator; this only keeps the process alive and shows the "Synced" notification
 * with a Stop action. Type `specialUse` per Android 14 rules.
 */
class SyncForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                SyncCoordinator.userStop()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_END -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "video"
        val notification = build(this, title)
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        RingLog.log("Service", "foreground: $title")
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        // Belt and braces: never leave brightness / torch / volume changed if the process dies.
        runCatching { AppGraph.actuators.endSession() }
        RingLog.log("Service", "destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.tricerasync.engine.action.STOP"
        const val ACTION_END = "com.tricerasync.engine.action.END"
        private const val EXTRA_TITLE = "title"
        private const val CHANNEL = "sync"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context, title: String) {
            val i = Intent(context, SyncForegroundService::class.java).putExtra(EXTRA_TITLE, title)
            runCatching {
                if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
            }.onFailure { RingLog.log("Service", "start failed: ${it.message}") }
        }

        fun stop(context: Context) {
            runCatching { context.startService(Intent(context, SyncForegroundService::class.java).setAction(ACTION_END)) }
        }

        private fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = context.getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(CHANNEL) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL, "Sync session", NotificationManager.IMPORTANCE_LOW).apply {
                        description = "Shown while TriceraSync fires cues for the current video"
                        setShowBadge(false)
                    },
                )
            }
        }

        private fun build(context: Context, title: String): Notification {
            val open = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val stop = PendingIntent.getService(
                context, 1, Intent(context, SyncForegroundService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            return NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("TriceraSync — synced")
                .setContentText(title)
                .setContentIntent(open)
                .addAction(0, "Stop", stop)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
        }
    }
}
