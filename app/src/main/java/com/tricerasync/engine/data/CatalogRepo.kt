// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.data

import android.content.Context
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.PcfParser
import com.tricerasync.engine.media.VideoIdentity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.math.abs

@Serializable
data class CatalogEntry(val d: Long, val t: String? = null, val c: String? = null)

@Serializable
data class Catalog(
    val version: Int = 1,
    val durationWindowMs: Long = 1500,
    val count: Int = 0,
    val entries: List<CatalogEntry> = emptyList(),
)

/**
 * Whether any known video sits within the matching window of this duration. An empty catalogue
 * covers nothing — the server has no published videos, so there is nothing to ask about.
 */
fun Catalog.covers(durationMs: Long): Boolean =
    entries.any { abs(it.d - durationMs) <= durationWindowMs }

@Serializable
private data class CachedCatalog(val json: String, val etag: String?, val fetchedAt: Long)

/**
 * A local copy of "which videos have a cue sheet", so ordinary YouTube viewing costs nothing.
 *
 * Without it the Engine fired a resolve request at every single video the user played. With it,
 * `mightHaveSheet()` answers from memory: a video whose duration is not within the matching
 * window of any published video cannot match server-side either, so we skip the network entirely
 * and never start a session.
 *
 * Deliberately gated on **duration only**. Titles can differ slightly between what YouTube
 * reports and what the creator stored (the server has a fuzzy tier for exactly that), so gating
 * on the title locally could produce false negatives the user would experience as "it just
 * doesn't work". Duration is exact and is a strong discriminator on its own.
 */
class CatalogRepo(context: Context, private val baseUrl: () -> String) {
    private val file = File(context.applicationContext.filesDir, "catalog.json")
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var cached: CachedCatalog? = null

    @Volatile
    var catalog: Catalog? = null
        private set

    init {
        runCatching {
            if (file.exists()) {
                val c = PcfParser.json.decodeFromString(CachedCatalog.serializer(), file.readText())
                cached = c
                catalog = PcfParser.json.decodeFromString(Catalog.serializer(), c.json)
            }
        }.onFailure { RingLog.log(TAG, "could not read cached catalog: ${it.message}") }
    }

    val fetchedAt: Long get() = cached?.fetchedAt ?: 0L
    val isStale: Boolean get() = System.currentTimeMillis() - fetchedAt > REFRESH_AFTER_MS

    /**
     * @return true when a lookup is worth making, false when the catalogue positively rules this
     *   video out, and **true when we have no catalogue at all** — never block on missing data.
     */
    fun mightHaveSheet(identity: VideoIdentity): Boolean =
        catalog?.covers(identity.durationMs) ?: true

    /** Human-readable state for the Settings screen. */
    fun summary(): String = when {
        catalog == null -> "not downloaded yet"
        else -> "${catalog!!.count} video(s), updated ${minutesAgo()} min ago"
    }

    private fun minutesAgo() = ((System.currentTimeMillis() - fetchedAt) / 60_000).coerceAtLeast(0)

    /** Fetches the catalogue if missing or stale (or always, when [force]). */
    suspend fun refresh(force: Boolean = false): Boolean = withContext(Dispatchers.IO) {
        if (!force && catalog != null && !isStale) return@withContext true
        val base = baseUrl().toHttpUrlOrNull()
        if (base == null) {
            // Offline / sample-sheet mode: no catalogue, so the gate stays open.
            catalog = null
            return@withContext false
        }
        val url = base.newBuilder().addPathSegments("api/v1/catalog").build()
        val req = Request.Builder().url(url)
            .apply { cached?.etag?.let { header("If-None-Match", it) } }
            .build()
        try {
            client.newCall(req).execute().use { res ->
                when (res.code) {
                    200 -> {
                        val body = res.body?.string() ?: return@use false
                        val parsed = PcfParser.json.decodeFromString(Catalog.serializer(), body)
                        store(CachedCatalog(body, res.header("ETag"), System.currentTimeMillis()), parsed)
                        RingLog.log(TAG, "catalog updated: ${parsed.count} video(s)")
                        true
                    }
                    304 -> {
                        cached?.let { store(it.copy(fetchedAt = System.currentTimeMillis()), catalog) }
                        true
                    }
                    else -> {
                        RingLog.log(TAG, "catalog HTTP ${res.code}")
                        false
                    }
                }
            }
        } catch (e: Exception) {
            RingLog.log(TAG, "catalog fetch failed: ${e.message}")
            false
        }
    }

    fun clear() {
        cached = null
        catalog = null
        runCatching { file.delete() }
    }

    private fun store(entry: CachedCatalog, parsed: Catalog?) {
        cached = entry
        if (parsed != null) catalog = parsed
        runCatching { file.writeText(PcfParser.json.encodeToString(CachedCatalog.serializer(), entry)) }
    }

    private companion object {
        const val TAG = "Catalog"
        const val REFRESH_AFTER_MS = 6L * 60 * 60 * 1000
    }
}
