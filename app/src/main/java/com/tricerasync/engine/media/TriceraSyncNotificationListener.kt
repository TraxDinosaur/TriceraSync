// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.media

import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationManagerCompat
import com.tricerasync.engine.core.log.RingLog

/**
 * Exists solely so the system grants us MediaSessionManager access (PRD FR-03). We never read
 * notification content — the callbacks below are intentionally empty.
 */
class TriceraSyncNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        RingLog.log(TAG, "listener connected")
        MediaSessionObserver.start(applicationContext)
    }

    override fun onListenerDisconnected() {
        RingLog.log(TAG, "listener disconnected")
        MediaSessionObserver.stop()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) = Unit
    override fun onNotificationRemoved(sbn: StatusBarNotification?) = Unit

    companion object {
        private const val TAG = "Listener"

        fun componentName(context: Context) =
            ComponentName(context, TriceraSyncNotificationListener::class.java)

        /** Whether the user has granted Notification Access to this app. */
        fun isEnabled(context: Context): Boolean =
            NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }
}
