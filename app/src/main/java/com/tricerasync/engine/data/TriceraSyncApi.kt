// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.data

import android.content.Context
import com.tricerasync.engine.core.log.RingLog
import com.tricerasync.engine.core.pcf.CueSheet
import com.tricerasync.engine.core.pcf.Match
import com.tricerasync.engine.core.pcf.PcfParser
import com.tricerasync.engine.core.pcf.ResolveResponse
import com.tricerasync.engine.media.VideoIdentity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import kotlin.math.abs

/** Outcome of asking the App for a cue sheet. */
sealed class ResolveResult {
    data class Found(val response: ResolveResponse, val etag: String?) : ResolveResult()
    data object NotModified : ResolveResult()
    data object NotFound : ResolveResult()
    data class Error(val message: String) : ResolveResult()
}

interface TriceraSyncApi {
    suspend fun resolve(identity: VideoIdentity, ifNoneMatch: String?): ResolveResult
}

/** GET /api/v1/resolve over OkHttp (PRD FR-07). */
class HttpTriceraSyncApi(private val baseUrl: () -> String) : TriceraSyncApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    override suspend fun resolve(identity: VideoIdentity, ifNoneMatch: String?): ResolveResult =
        withContext(Dispatchers.IO) {
            val base = baseUrl().toHttpUrlOrNull() ?: return@withContext ResolveResult.Error("invalid base URL")
            val url = base.newBuilder()
                .addPathSegments("api/v1/resolve")
                .addQueryParameter("title", identity.rawTitle)
                .apply { identity.rawChannel?.let { addQueryParameter("channel", it) } }
                .addQueryParameter("durationMs", identity.durationMs.toString())
                .build()
            val req = Request.Builder().url(url)
                .apply { ifNoneMatch?.let { header("If-None-Match", it) } }
                .build()
            try {
                client.newCall(req).execute().use { res ->
                    RingLog.log("Api", "GET resolve → ${res.code} (${identity.rawTitle.take(40)}…)")
                    when (res.code) {
                        200 -> {
                            val body = res.body?.string() ?: return@use ResolveResult.Error("empty body")
                            ResolveResult.Found(PcfParser.parseResolve(body), res.header("ETag"))
                        }
                        304 -> ResolveResult.NotModified
                        404 -> ResolveResult.NotFound
                        else -> ResolveResult.Error("HTTP ${res.code}")
                    }
                }
            } catch (e: Exception) {
                RingLog.log("Api", "resolve failed: ${e.message}")
                ResolveResult.Error(e.message ?: e.javaClass.simpleName)
            }
        }
}

/**
 * Offline stand-in used when no base URL is configured: answers with the bundled sample sheet
 * whenever the identity looks like the sample video (title or duration match).
 */
class FakeTriceraSyncApi(context: Context) : TriceraSyncApi {
    private val sample: CueSheet by lazy {
        PcfParser.parseSheet(context.assets.open("sample-sheet.json").bufferedReader().readText())
    }

    override suspend fun resolve(identity: VideoIdentity, ifNoneMatch: String?): ResolveResult {
        val s = sample
        val titleMatch = com.tricerasync.engine.core.matching.Normalize.normalize(s.video.title) == identity.titleNorm
        val durationMatch = s.video.durationMs?.let { abs(it - identity.durationMs) <= 1500 } == true
        RingLog.log("Api", "fake resolve title=$titleMatch duration=$durationMatch")
        return if (titleMatch || durationMatch) {
            ResolveResult.Found(ResolveResponse(Match(s.video.id, if (titleMatch) "exact" else "fuzzy"), s), null)
        } else {
            ResolveResult.NotFound
        }
    }
}
