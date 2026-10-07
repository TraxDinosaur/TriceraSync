// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.data

import android.content.Context
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.PcfParser
import com.tricerasync.engine.core.pcf.ResolveResponse
import com.tricerasync.engine.media.VideoIdentity
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest

/** What the coordinator gets back. */
sealed class Resolution {
    data class Resolved(val response: ResolveResponse, val fromCache: Boolean) : Resolution()
    data object NotFound : Resolution()
    data class Failed(val message: String) : Resolution()
}

/**
 * Cache-first resolver (PRD FR-07): memory → disk (`filesDir/sheet-cache`) → network with
 * `If-None-Match`. Positive entries live 24 h, negative ones 10 min. A network error with a
 * stale positive entry still returns the cached sheet (offline NFR).
 */
class CueResolver(context: Context, private val api: () -> TriceraSyncApi) {
    @Serializable
    private data class Entry(
        val json: String? = null,
        val etag: String? = null,
        val fetchedAt: Long,
        val negativeUntil: Long = 0,
    )

    private val dir = File(context.applicationContext.filesDir, "sheet-cache").apply { mkdirs() }
    private val memory = HashMap<String, Entry>()
    private val fmt = Json { ignoreUnknownKeys = true }

    /**
     * @param forceRefresh skip both the positive and the negative cache and ask the server.
     *   Used by the Retry button and the Settings resolve test, where the whole point is to
     *   re-check after something changed (base URL, server started, sheet published).
     */
    suspend fun resolve(identity: VideoIdentity, forceRefresh: Boolean = false): Resolution {
        val key = identity.key
        val now = System.currentTimeMillis()
        val cached = memory[key] ?: load(key)?.also { memory[key] = it }

        if (cached != null && !forceRefresh) {
            if (cached.json != null && now - cached.fetchedAt < POSITIVE_TTL_MS) {
                return Resolution.Resolved(PcfParser.parseResolve(cached.json), fromCache = true)
            }
            if (cached.json == null && now < cached.negativeUntil) return Resolution.NotFound
        }

        return when (val r = api().resolve(identity, cached?.etag)) {
            is ResolveResult.Found -> {
                val json = PcfParser.json.encodeToString(ResolveResponse.serializer(), r.response)
                store(key, Entry(json = json, etag = r.etag, fetchedAt = now))
                Resolution.Resolved(r.response, fromCache = false)
            }
            ResolveResult.NotModified -> {
                val json = cached?.json ?: return Resolution.Failed("304 without cache")
                store(key, cached.copy(fetchedAt = now))
                Resolution.Resolved(PcfParser.parseResolve(json), fromCache = true)
            }
            ResolveResult.NotFound -> {
                store(key, Entry(fetchedAt = now, negativeUntil = now + NEGATIVE_TTL_MS))
                Resolution.NotFound
            }
            is ResolveResult.Error -> {
                val json = cached?.json
                if (json != null) {
                    RingLog.log("Resolver", "network error, serving stale cache: ${r.message}")
                    Resolution.Resolved(PcfParser.parseResolve(json), fromCache = true)
                } else Resolution.Failed(r.message)
            }
        }
    }

    fun clear() {
        memory.clear()
        dir.listFiles()?.forEach { it.delete() }
        RingLog.log("Resolver", "cache cleared")
    }

    private fun file(key: String) = File(dir, sha1(key) + ".json")

    private fun load(key: String): Entry? = runCatching {
        val f = file(key)
        if (!f.exists()) null else fmt.decodeFromString(Entry.serializer(), f.readText())
    }.getOrNull()

    private fun store(key: String, e: Entry) {
        memory[key] = e
        runCatching { file(key).writeText(fmt.encodeToString(Entry.serializer(), e)) }
    }

    private fun sha1(s: String): String =
        MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    private companion object {
        const val POSITIVE_TTL_MS = 24L * 60 * 60 * 1000
        const val NEGATIVE_TTL_MS = 10L * 60 * 1000
    }
}
