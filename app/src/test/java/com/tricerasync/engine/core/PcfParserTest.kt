// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core

import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.PcfParser
import com.tricerasync.engine.core.pcf.VibrateParams
import com.tricerasync.engine.media.VideoIdentity
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PcfParserTest {
    private val sample = javaClass.getResourceAsStream("/sample-sheet.json")!!.bufferedReader().readText()

    @Test
    fun `parses the App seed sheet`() {
        val sheet = PcfParser.parseSheet(sample)
        assertEquals(1, sheet.version)
        assertEquals("dQw4w9WgXcQ", sheet.video.id)
        assertEquals(213_000, sheet.video.durationMs)
        assertEquals(9, sheet.cues.size)
        assertEquals(120, sheet.defaults.toleranceMs)
        assertTrue(sheet.defaults.restoreOnEnd)
        assertEquals(30.0, sheet.meta.fps)

        val first = sheet.cues.first()
        assertIs<Cue.Vibrate>(first)
        assertIs<VibrateParams.Predefined>(first.params)
        assertEquals("HEAVY_CLICK", (first.params as VibrateParams.Predefined).effect)

        val dim = sheet.cues.first { it.id == "c_dim" }
        assertIs<Cue.Brightness>(dim)
        assertEquals(3000, dim.durationMs)
        assertEquals(0.15f, dim.params.level)
        assertEquals(500, dim.params.rampMs)

        val beat = sheet.cues.first { it.id == "c_beat1" } as Cue.Vibrate
        val wf = assertIs<VibrateParams.Waveform>(beat.params)
        assertEquals(listOf(0L, 80L, 90L, 110L), wf.timings)
        assertEquals(-1, wf.repeat)

        val flash = sheet.cues.first { it.id == "c_flash" } as Cue.Flash
        assertEquals("#FF3B00", flash.params.color)
        assertEquals(260, flash.params.fadeOutMs)

        val torch = sheet.cues.first { it.id == "c_torch" } as Cue.Torch
        assertTrue(torch.params.on)
        assertEquals(150, torch.params.durationMs)
    }

    @Test
    fun `unknown cue types and modes are kept as Unknown and excluded from playable`() {
        val text = """
            {"version":1,"video":{"provider":"youtube","id":null,"title":"t","channel":"c","durationMs":10000},
             "meta":{"sheetVersion":1,"createdAt":"2026-09-11T00:00:00Z"},
             "cues":[
               {"id":"c_a","at":500,"type":"laser","params":{"power":9}},
               {"id":"c_b","at":100,"type":"vibrate","params":{"mode":"composition","primitives":[]}},
               {"id":"c_c","at":300,"type":"flash","params":{"color":"#FFFFFF","durationMs":100}}
             ]}
        """.trimIndent()
        val sheet = PcfParser.parseSheet(text)
        assertEquals(3, sheet.cues.size)
        assertIs<Cue.Unknown>(sheet.cues[0])
        assertEquals("laser", sheet.cues[0].type)
        val vib = assertIs<Cue.Vibrate>(sheet.cues[1])
        assertIs<VibrateParams.Unknown>(vib.params)
        // playable keeps the vibrate (the actuator will skip the unknown mode) and sorts by at
        assertEquals(listOf("c_b", "c_c"), sheet.playable.map { it.id })
        assertEquals(0.6f, (sheet.cues[2] as Cue.Flash).params.opacity) // default applied
    }

    @Test
    fun `cache round-trip preserves cue types (regression - encodeDefaults)`() {
        // The resolver caches by re-encoding the parsed response; the discriminator must survive.
        val original = PcfParser.parseSheet(sample)
        val response = com.tricerasync.engine.core.pcf.ResolveResponse(
            com.tricerasync.engine.core.pcf.Match("dQw4w9WgXcQ", "exact"),
            original,
        )
        val encoded = PcfParser.json.encodeToString(
            com.tricerasync.engine.core.pcf.ResolveResponse.serializer(),
            response,
        )
        val decoded = PcfParser.parseResolve(encoded)
        assertEquals(original.playable.size, decoded.sheet.playable.size)
        assertEquals(9, decoded.sheet.playable.size)
        assertIs<Cue.Vibrate>(decoded.sheet.cues.first())
        assertIs<VibrateParams.Predefined>((decoded.sheet.cues.first() as Cue.Vibrate).params)
    }

    @Test
    fun `parses a resolve response`() {
        val r = PcfParser.parseResolve("""{"match":{"videoId":"dQw4w9WgXcQ","confidence":"exact"},"sheet":$sample}""")
        assertEquals("exact", r.match.confidence)
        assertEquals(9, r.sheet.cues.size)
    }

    @Test
    fun `instant vs state classification`() {
        val sheet = PcfParser.parseSheet(sample)
        assertTrue(sheet.cues.first { it.id == "c_flash" }.isInstant)
        assertTrue(sheet.cues.first { it.id == "c_dim" }.isState)
        assertTrue(sheet.cues.first { it.id == "c_torch" }.isState)
    }

    @Test
    fun `video identity requires title and duration`() {
        assertNull(VideoIdentity.from(null, "c", 1000))
        assertNull(VideoIdentity.from("t", "c", 0))
        val id = assertNotNull(VideoIdentity.from("  Rick Astley 🔥 ", "Rick Astley", 213_000))
        assertEquals("rick astley", id.titleNorm)
        assertEquals("rick astley|rick astley|213000", id.key)
    }
}
