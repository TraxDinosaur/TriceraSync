// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine

import android.app.Application
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.media.MediaSessionObserver
import com.tricerasync.engine.media.TriceraSyncNotificationListener
import com.tricerasync.engine.sync.SyncCoordinator

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        RingLog.log("App", "TriceraSync Engine ${BuildConfig.VERSION_NAME} starting")
        AppGraph.init(this)
        AppGraph.actuators.restoreOrphanedBaselines()
        SyncCoordinator.start(this)
        // If Notification Access is already granted the listener may be bound before we run;
        // starting the observer here is idempotent.
        if (TriceraSyncNotificationListener.isEnabled(this)) MediaSessionObserver.start(this)
    }
}
