// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.sync

import android.content.Context
import android.content.Intent
import android.media.session.PlaybackState
import android.os.SystemClock
import com.tricerasync.engine.AppGraph
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.CueSheet
import com.tricerasync.engine.data.Resolution
import com.tricerasync.engine.media.MediaSessionObserver
import com.tricerasync.engine.media.PlaybackSnapshot
import com.tricerasync.engine.media.TargetPlayback
import com.tricerasync.engine.media.VideoIdentity
import com.tricerasync.engine.service.SyncForegroundService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

enum class SyncStatus { NOT_LISTENING, LISTENING, RESOLVING, NO_SHEET, READY, SYNCED, ERROR }

data class CoordinatorUi(
    val status: SyncStatus = SyncStatus.NOT_LISTENING,
    val identity: VideoIdentity? = null,
    val confidence: String? = null,
    val fromCache: Boolean = false,
    val message: String? = null,
    val session: SessionUi? = null,
    val simulating: Boolean = false,
)

/**
 * Glue between the observer, the resolver and sync sessions (PRD FR-06, FR-17, FR-21/22).
 * Identity change → resolve → (auto)start session; playback snapshots → session; STOPPED or
 * identity loss → stop + restore.
 */
object SyncCoordinator {
    private const val TAG = "Coordinator"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _ui = MutableStateFlow(CoordinatorUi())
    val ui: StateFlow<CoordinatorUi> = _ui

    private var appContext: Context? = null
    private var observing: Job? = null
    private var uiMirror: Job? = null
    private var session: SyncSession? = null
    private var currentKey: String? = null
    /** Identity the running session belongs to, so a stray snapshot cannot leak into it. */
    private var sessionKey: String? = null
    private var pendingSheet: CueSheet? = null
    private var simulation: Job? = null

    fun start(context: Context) {
        if (observing != null) return
        appContext = context.applicationContext
        // Two independent collectors on purpose.
        //
        // Playback updates must never be cancelled or delayed: they used to share a
        // `collectLatest` with resolution, which meant a snapshot arriving mid-lookup cancelled
        // the lookup, and — worse — the snapshot captured *before* the lookup was delivered to
        // the freshly started session afterwards, re-anchoring it to where the video was several
        // hundred milliseconds earlier. That is what made a video "start from the beginning".
        observing = scope.launch {
            MediaSessionObserver.target.collect { target -> onPlayback(target) }
        }
        // Resolution is keyed by identity, so `collectLatest` now only cancels when the video
        // genuinely changes — not on every playback tick.
        scope.launch {
            MediaSessionObserver.target
                .map { it?.identity }
                .distinctUntilChanged { a, b -> a?.key == b?.key }
                .collectLatest { identity -> onIdentity(identity) }
        }
        scope.launch {
            MediaSessionObserver.running.collect { running ->
                if (!running && _ui.value.status == SyncStatus.NOT_LISTENING) return@collect
                if (!running) _ui.value = _ui.value.copy(status = SyncStatus.NOT_LISTENING)
                else if (_ui.value.status == SyncStatus.NOT_LISTENING) _ui.value = _ui.value.copy(status = SyncStatus.LISTENING)
            }
        }
    }

    /**
     * Feeds every playback update straight to the running session.
     *
     * Deliberately not filtered by identity: an identity change already stops the session through
     * [onIdentity], and the scheduler rejects snapshots older than the one it holds, so there is
     * nothing left for a key comparison to protect against — while a mismatch (a duration that
     * refines by a millisecond, say) would silently starve the session of every update.
     */
    private fun onPlayback(target: TargetPlayback?) {
        if (_ui.value.simulating) return
        val snapshot = target?.snapshot ?: return
        val s = session ?: return
        s.onPlayback(snapshot)
        if (snapshot.state == PlaybackState.STATE_STOPPED) stopSession("playback stopped")
    }

    private suspend fun onIdentity(identity: VideoIdentity?) {
        if (_ui.value.simulating) return
        stopSession("identity changed")
        currentKey = identity?.key
        pendingSheet = null
        if (identity == null) {
            _ui.value = _ui.value.copy(status = SyncStatus.LISTENING, identity = null, confidence = null, message = null)
            return
        }
        resolveFor(identity)
    }

    private suspend fun resolveFor(identity: VideoIdentity, forceRefresh: Boolean = false) {
        _ui.value = _ui.value.copy(status = SyncStatus.RESOLVING, identity = identity, confidence = null, message = null)
        // Cheap local gate: if no published video is anywhere near this duration, the server
        // would 404 too, so do not spend a request (or a session) on ordinary viewing.
        if (!forceRefresh && !AppGraph.catalog.mightHaveSheet(identity)) {
            _ui.value = _ui.value.copy(status = SyncStatus.NO_SHEET, message = "No TriceraSync sheet for this video")
            RingLog.log(TAG, "skipped (not in catalog): ${identity.rawTitle} (${identity.durationMs} ms)")
            return
        }
        when (val r = AppGraph.resolver.resolve(identity, forceRefresh)) {
            is Resolution.Resolved -> {
                pendingSheet = r.response.sheet
                _ui.value = _ui.value.copy(
                    status = SyncStatus.READY,
                    confidence = r.response.match.confidence,
                    fromCache = r.fromCache,
                    message = "v${r.response.sheet.meta.sheetVersion} · ${r.response.sheet.playable.size} cues",
                )
                RingLog.log(TAG, "resolved ${r.response.match.confidence}${if (r.fromCache) " (cache)" else ""}: ${identity.rawTitle}")
                if (AppGraph.settings.value.autoStart) startSession()
            }
            Resolution.NotFound -> {
                _ui.value = _ui.value.copy(status = SyncStatus.NO_SHEET, message = "No TriceraSync sheet for this video")
                RingLog.log(TAG, "no sheet: ${identity.rawTitle} (${identity.durationMs} ms)")
            }
            is Resolution.Failed -> {
                // Transient (server down, Wi-Fi dropped) — not cached as a miss, so a retry is
                // worth offering. One automatic attempt, then it is up to the user.
                _ui.value = _ui.value.copy(status = SyncStatus.ERROR, message = r.message)
                RingLog.log(TAG, "resolve failed: ${r.message}")
            }
        }
    }

    /** Re-runs the lookup for whatever is playing — used by the Retry button and after a settings change. */
    fun retry() {
        val identity = MediaSessionObserver.target.value?.identity ?: _ui.value.identity ?: return
        scope.launch {
            currentKey = identity.key
            pendingSheet = null
            resolveFor(identity, forceRefresh = true)
        }
    }

    /** Starts the session for the resolved sheet (auto or from the Home button). */
    fun startSession() {
        val ctx = appContext ?: return
        val sheet = pendingSheet ?: return
        if (session != null) return
        val s = SyncSession(
            sheet,
            AppGraph.actuators,
            scope,
            tickMs = AppGraph.settings.value.tickMs,
            offsetMs = AppGraph.settings.value.offsetMs,
        )
        session = s
        sessionKey = currentKey
        s.start()
        // Anchor on the freshest reading there is. The lookup may have spanned the whole
        // BUFFERING → PLAYING burst at the start of the video, and YouTube will not publish
        // another callback until playback changes state again — so ask the controller directly
        // rather than trusting the last snapshot that happened to arrive.
        val seed = MediaSessionObserver.freshSnapshot() ?: MediaSessionObserver.target.value?.snapshot
        seed?.let { s.onPlayback(it) }
        uiMirror = scope.launch { s.ui.collect { _ui.value = _ui.value.copy(status = SyncStatus.SYNCED, session = it) } }
        SyncForegroundService.start(ctx, sheet.video.title ?: "video")
    }

    fun stopSession(reason: String) {
        val s = session ?: return
        uiMirror?.cancel()
        uiMirror = null
        session = null
        sessionKey = null
        s.stop(reason)
        appContext?.let { SyncForegroundService.stop(it) }
        _ui.value = _ui.value.copy(
            status = if (pendingSheet != null) SyncStatus.READY else SyncStatus.LISTENING,
            session = null,
        )
    }

    /** User pressed Stop in the notification: end the session and forget this video until it changes. */
    fun userStop() {
        stopSession("user")
        pendingSheet = null
        _ui.value = _ui.value.copy(status = SyncStatus.LISTENING, message = "Stopped by you")
    }

    // --- Debug: simulate playback of the bundled sample sheet without YouTube (FR-26) --------

    fun startSimulation(sheet: CueSheet) {
        val ctx = appContext ?: return
        stopSimulation()
        stopSession("simulation")
        _ui.value = _ui.value.copy(simulating = true, identity = VideoIdentity(sheet.video.title ?: "sample", sheet.video.channel, sheet.video.durationMs ?: 0), confidence = "simulated")
        val s = SyncSession(
            sheet,
            AppGraph.actuators,
            scope,
            tickMs = AppGraph.settings.value.tickMs,
            offsetMs = AppGraph.settings.value.offsetMs,
        )
        session = s
        s.start()
        uiMirror = scope.launch { s.ui.collect { _ui.value = _ui.value.copy(status = SyncStatus.SYNCED, session = it) } }
        SyncForegroundService.start(ctx, "Simulation")
        simulate(PlaybackState.STATE_PLAYING, 0)
        val duration = sheet.video.durationMs ?: 60_000
        simulation = scope.launch {
            delay(duration + 1000)
            stopSimulation()
        }
    }

    fun simulate(state: Int, positionMs: Long, speed: Float = 1f) {
        session?.onPlayback(PlaybackSnapshot(state, positionMs, speed, SystemClock.elapsedRealtime()))
    }

    fun simulatedPosition(): Long = session?.scheduler?.positionNow ?: 0L

    fun stopSimulation() {
        simulation?.cancel()
        simulation = null
        if (_ui.value.simulating) {
            stopSession("simulation ended")
            _ui.value = _ui.value.copy(simulating = false, identity = null, confidence = null, status = SyncStatus.LISTENING)
            currentKey = null
        }
    }

    fun notificationStopIntent(context: Context): Intent =
        Intent(context, SyncForegroundService::class.java).setAction(SyncForegroundService.ACTION_STOP)
}
