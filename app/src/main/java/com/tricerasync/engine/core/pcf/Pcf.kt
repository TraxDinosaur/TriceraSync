// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core.pcf

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * TriceraSync Cue Format v1 — mirror of `TriceraSync App/tricerasync-app/src/lib/pcf/schema.js`.
 * Unknown cue types and unknown vibrate modes deserialize to `Unknown` and are skipped by the
 * scheduler (App PRD §8.1 forward-compat rule, Engine FR-09).
 */
const val PCF_VERSION = 1

@Serializable
data class CueSheet(
    val version: Int,
    val video: VideoBlock,
    val meta: Meta,
    val defaults: Defaults = Defaults(),
    val cues: List<Cue>,
) {
    /** Cues the Engine knows how to fire, sorted by `at`. */
    val playable: List<Cue> get() = cues.filter { it !is Cue.Unknown }.sortedBy { it.at }
}

@Serializable
data class VideoBlock(
    val provider: String = "youtube",
    val id: String? = null,
    val title: String? = null,
    val channel: String? = null,
    val durationMs: Long? = null,
)

@Serializable
data class Meta(val sheetVersion: Int, val createdAt: String, val fps: Double? = null)

@Serializable
data class Defaults(val restoreOnEnd: Boolean = true, val toleranceMs: Long = 120)

/** Response of GET /api/v1/resolve. */
@Serializable
data class ResolveResponse(val match: Match, val sheet: CueSheet)

@Serializable
data class Match(val videoId: String? = null, val confidence: String)

@Serializable(with = CueSerializer::class)
sealed class Cue {
    abstract val id: String
    abstract val at: Long
    /** Hold-then-restore window for state cues; ignored by instant cues. */
    abstract val durationMs: Long?
    abstract val type: String

    val isInstant: Boolean get() = this is Vibrate || this is Flash
    val isState: Boolean get() = this is Brightness || this is Volume || this is Torch

    @Serializable
    data class Vibrate(
        override val id: String,
        override val at: Long,
        override val durationMs: Long? = null,
        override val type: String = "vibrate",
        val params: VibrateParams,
    ) : Cue()

    @Serializable
    data class Brightness(
        override val id: String,
        override val at: Long,
        override val durationMs: Long? = null,
        override val type: String = "brightness",
        val params: LevelParams,
    ) : Cue()

    @Serializable
    data class Volume(
        override val id: String,
        override val at: Long,
        override val durationMs: Long? = null,
        override val type: String = "volume",
        val params: LevelParams,
    ) : Cue()

    @Serializable
    data class Flash(
        override val id: String,
        override val at: Long,
        override val durationMs: Long? = null,
        override val type: String = "flash",
        val params: FlashParams,
    ) : Cue()

    @Serializable
    data class Torch(
        override val id: String,
        override val at: Long,
        override val durationMs: Long? = null,
        override val type: String = "torch",
        val params: TorchParams,
    ) : Cue()

    /** Anything this build does not understand — kept for logging, never fired. */
    @Serializable
    data class Unknown(
        override val id: String = "?",
        override val at: Long = 0,
        override val durationMs: Long? = null,
        override val type: String = "unknown",
        val params: JsonObject? = null,
    ) : Cue()
}

@Serializable
data class LevelParams(val level: Float, val rampMs: Long = 0)

@Serializable
data class FlashParams(
    val color: String,
    val opacity: Float = 0.6f,
    val durationMs: Long,
    val fadeOutMs: Long = 0,
)

@Serializable
data class TorchParams(val on: Boolean, val durationMs: Long? = null, val strength: Float = 1f)

@Serializable(with = VibrateParamsSerializer::class)
sealed class VibrateParams {
    abstract val mode: String

    @Serializable
    data class OneShot(
        override val mode: String = "oneShot",
        val durationMs: Long,
        val amplitude: Int = 255,
    ) : VibrateParams()

    @Serializable
    data class Waveform(
        override val mode: String = "waveform",
        val timings: List<Long>,
        val amplitudes: List<Int>,
        val repeat: Int = -1,
    ) : VibrateParams()

    @Serializable
    data class Predefined(override val mode: String = "predefined", val effect: String) : VibrateParams()

    @Serializable
    data class Unknown(override val mode: String = "unknown") : VibrateParams()
}

/** Picks the cue subclass from the `type` field; unknown → `Cue.Unknown`. */
object CueSerializer : JsonContentPolymorphicSerializer<Cue>(Cue::class) {
    override fun selectDeserializer(element: JsonElement): KSerializer<out Cue> =
        when (element.jsonObject["type"]?.jsonPrimitive?.content) {
            "vibrate" -> Cue.Vibrate.serializer()
            "brightness" -> Cue.Brightness.serializer()
            "volume" -> Cue.Volume.serializer()
            "flash" -> Cue.Flash.serializer()
            "torch" -> Cue.Torch.serializer()
            else -> Cue.Unknown.serializer()
        }
}

object VibrateParamsSerializer : JsonContentPolymorphicSerializer<VibrateParams>(VibrateParams::class) {
    override fun selectDeserializer(element: JsonElement): KSerializer<out VibrateParams> =
        when (element.jsonObject["mode"]?.jsonPrimitive?.content) {
            "oneShot" -> VibrateParams.OneShot.serializer()
            "waveform" -> VibrateParams.Waveform.serializer()
            "predefined" -> VibrateParams.Predefined.serializer()
            else -> VibrateParams.Unknown.serializer()
        }
}

object PcfParser {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
        // MUST stay true: cues/params carry their discriminator (`type` / `mode`) as a default
        // value. Without this the cache re-encode would drop it and every cue would read back
        // as Unknown (0 playable cues).
        encodeDefaults = true
    }

    /** Parses a bare PCF document (what /api/v1/cue-sheets/:id returns as `sheet`, or a local file). */
    fun parseSheet(text: String): CueSheet = json.decodeFromString(CueSheet.serializer(), text)

    /** Parses a /api/v1/resolve body. */
    fun parseResolve(text: String): ResolveResponse = json.decodeFromString(ResolveResponse.serializer(), text)
}
