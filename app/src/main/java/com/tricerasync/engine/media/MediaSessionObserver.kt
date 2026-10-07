// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.media

import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSession
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import com.tricerasync.engine.core.log.RingLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Everything we currently know about one active media session (Phase 1 spike dump). */
data class SessionDump(
    val packageName: String,
    val isTarget: Boolean,
    val title: String?,
    val artist: String?,
    val album: String?,
    val durationMs: Long?,
    val mediaId: String?,
    val metadata: Map<String, String>,
    val snapshot: PlaybackSnapshot?,
    val lastEventAt: Long,
    val eventCount: Int,
)

/**
 * Watches active media sessions through MediaSessionManager (needs Notification Access) and
 * publishes a dump of each one. Phase 1 goal: prove YouTube exposes title / channel / duration
 * and a usable PlaybackState (position, speed, lastPositionUpdateTime). PRD FR-04/05.
 */
object MediaSessionObserver {
    private const val TAG = "Sessions"
    private val BITMAP_KEYS = setOf(
        MediaMetadata.METADATA_KEY_ART,
        MediaMetadata.METADATA_KEY_ALBUM_ART,
        MediaMetadata.METADATA_KEY_DISPLAY_ICON,
    )

    /** Packages we act on. Official YouTube plus known modded clients; configurable later (FR-04). */
    @Volatile
    var targetPackages: Set<String> = setOf(
        "com.google.android.youtube",
        "app.revanced.android.youtube",
        "app.rvx.android.youtube",
        "com.vanced.android.youtube",
        "app.morphe.android.youtube",
    )

    /**
     * Matches the official app and every modded client — ReVanced, RVX, Vanced, Morphe all
     * keep the `.android.youtube` suffix and expose the same MediaSession.
     */
    fun isTargetPackage(pkg: String): Boolean =
        pkg in targetPackages || pkg.endsWith(".android.youtube")

    private val _sessions = MutableStateFlow<List<SessionDump>>(emptyList())
    val sessions: StateFlow<List<SessionDump>> = _sessions

    private val _running = MutableStateFlow(false)
    val running: StateFlow<Boolean> = _running

    /**
     * The one target session the sync layer follows: the most recently active YouTube session
     * (PLAYING wins over others; then the latest event). Null when no target session exists.
     */
    private val _target = MutableStateFlow<TargetPlayback?>(null)
    val target: StateFlow<TargetPlayback?> = _target

    private val handler = Handler(Looper.getMainLooper())
    private var manager: MediaSessionManager? = null
    private var appContext: Context? = null
    private val tracked = LinkedHashMap<MediaSession.Token, Tracked>()

    private class Tracked(val controller: MediaController, val callback: MediaController.Callback) {
        var dump: SessionDump? = null
        var events = 0
    }

    private val sessionsChanged = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
        sync(controllers ?: emptyList())
    }

    @Synchronized
    fun start(context: Context) {
        if (manager != null) return
        val ctx = context.applicationContext
        appContext = ctx
        val msm = ctx.getSystemService(MediaSessionManager::class.java)
        manager = msm
        val cn = TriceraSyncNotificationListener.componentName(ctx)
        try {
            msm.addOnActiveSessionsChangedListener(sessionsChanged, cn, handler)
            sync(msm.getActiveSessions(cn))
            _running.value = true
            RingLog.log(TAG, "observer started")
        } catch (e: SecurityException) {
            RingLog.log(TAG, "no notification access yet: ${e.message}")
            manager = null
        }
    }

    @Synchronized
    fun stop() {
        manager?.removeOnActiveSessionsChangedListener(sessionsChanged)
        manager = null
        tracked.values.forEach { it.controller.unregisterCallback(it.callback) }
        tracked.clear()
        _sessions.value = emptyList()
        _running.value = false
        RingLog.log(TAG, "observer stopped")
    }

    /** Re-query the system (used by the Refresh button). */
    fun refresh() {
        val ctx = appContext ?: return
        val msm = manager ?: return
        try {
            sync(msm.getActiveSessions(TriceraSyncNotificationListener.componentName(ctx)))
        } catch (e: SecurityException) {
            RingLog.log(TAG, "refresh failed: ${e.message}")
        }
    }

    @Synchronized
    private fun sync(controllers: List<MediaController>) {
        val seen = HashSet<MediaSession.Token>()
        for (c in controllers) {
            seen += c.sessionToken
            if (tracked.containsKey(c.sessionToken)) continue
            val cb = object : MediaController.Callback() {
                override fun onMetadataChanged(metadata: MediaMetadata?) {
                    RingLog.log(TAG, "${c.packageName} metadata: ${metadata?.describeShort()}")
                    update(c.sessionToken)
                }

                override fun onPlaybackStateChanged(state: PlaybackState?) {
                    RingLog.log(
                        TAG,
                        "${c.packageName} state: ${state?.let { PlaybackSnapshot.stateName(it.state) }} " +
                            "pos=${state?.position} speed=${state?.playbackSpeed} " +
                            "updatedAt=${state?.lastPositionUpdateTime}",
                    )
                    update(c.sessionToken)
                }

                override fun onSessionDestroyed() {
                    RingLog.log(TAG, "${c.packageName} session destroyed")
                    remove(c.sessionToken)
                }
            }
            c.registerCallback(cb, handler)
            tracked[c.sessionToken] = Tracked(c, cb)
            RingLog.log(TAG, "tracking ${c.packageName}" + if (isTargetPackage(c.packageName)) " (target)" else "")
            update(c.sessionToken)
        }
        for (token in tracked.keys.toList()) if (token !in seen) remove(token)
        publish()
    }

    @Synchronized
    private fun update(token: MediaSession.Token) {
        val t = tracked[token] ?: return
        t.events++
        val c = t.controller
        val md = c.metadata
        val ps = c.playbackState
        t.dump = SessionDump(
            packageName = c.packageName,
            isTarget = isTargetPackage(c.packageName),
            title = md?.getString(MediaMetadata.METADATA_KEY_TITLE),
            artist = md?.getString(MediaMetadata.METADATA_KEY_ARTIST),
            album = md?.getString(MediaMetadata.METADATA_KEY_ALBUM),
            durationMs = md?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it > 0 },
            mediaId = md?.getString(MediaMetadata.METADATA_KEY_MEDIA_ID),
            metadata = md?.toDisplayMap() ?: emptyMap(),
            snapshot = ps?.let { PlaybackSnapshot.from(it) },
            lastEventAt = System.currentTimeMillis(),
            eventCount = t.events,
        )
        publish()
    }

    @Synchronized
    private fun remove(token: MediaSession.Token) {
        tracked.remove(token)?.let { it.controller.unregisterCallback(it.callback) }
        publish()
    }

    private fun publish() {
        val dumps = tracked.values.mapNotNull { it.dump }.sortedByDescending { it.isTarget }
        _sessions.value = dumps
        val chosen = dumps
            .filter { it.isTarget }
            .sortedWith(compareByDescending<SessionDump> { it.snapshot?.isPlaying == true }.thenByDescending { it.lastEventAt })
            .firstOrNull()
        _target.value = chosen?.let {
            TargetPlayback(
                packageName = it.packageName,
                identity = VideoIdentity.from(it.title, it.artist, it.durationMs),
                snapshot = it.snapshot,
            )
        }
    }

    /**
     * Re-reads the target controller's `PlaybackState` **now**, instead of returning whatever the
     * last callback happened to leave behind.
     *
     * This matters because YouTube only publishes a callback when playback *changes* state. A
     * lookup that takes a few hundred milliseconds can easily span the whole BUFFERING → PLAYING
     * burst at the start of a video, and the cached snapshot is then a stale BUFFERING one — so a
     * session seeded from it would sit there believing playback had not started, with no further
     * callback coming to correct it until the user pauses or seeks.
     */
    @Synchronized
    fun freshSnapshot(): PlaybackSnapshot? {
        val pkg = _target.value?.packageName ?: return null
        val controller = tracked.values.firstOrNull { it.controller.packageName == pkg }?.controller
            ?: return null
        return runCatching { controller.playbackState?.let { PlaybackSnapshot.from(it) } }.getOrNull()
    }

    /** Every key in the metadata with a printable value (bitmaps summarised). */
    private fun MediaMetadata.toDisplayMap(): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        for (key in keySet()) {
            val short = key.removePrefix("android.media.metadata.")
            out[short] = when {
                key in BITMAP_KEYS -> getBitmap(key)?.let { "<bitmap ${it.width}x${it.height}>" } ?: "<null>"
                key.contains("RATING") -> getRating(key)?.toString() ?: "<null>"
                else -> getText(key)?.toString() ?: getLong(key).toString()
            }
        }
        return out
    }

    private fun MediaMetadata.describeShort(): String =
        "title=${getString(MediaMetadata.METADATA_KEY_TITLE)} artist=${getString(MediaMetadata.METADATA_KEY_ARTIST)} " +
            "duration=${getLong(MediaMetadata.METADATA_KEY_DURATION)}"
}
