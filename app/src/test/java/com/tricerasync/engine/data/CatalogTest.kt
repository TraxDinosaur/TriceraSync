// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.data

import com.tricerasync.engine.core.pcf.PcfParser
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CatalogTest {
    private val catalog = Catalog(
        durationWindowMs = 1500,
        count = 3,
        entries = listOf(
            CatalogEntry(d = 10_005, t = "10 sec 2d test animation", c = "yanmotion"),
            CatalogEntry(d = 187_000, t = "mexican coke", c = "kalamkaar"),
            CatalogEntry(d = 214_000, t = "rick astley never gonna give you up", c = "rick astley"),
        ),
    )

    @Test
    fun `covers a known duration and the window around it`() {
        assertTrue(catalog.covers(214_000))
        assertTrue(catalog.covers(213_000)) // what YouTube reports for the same video
        assertTrue(catalog.covers(215_500))
    }

    @Test
    fun `rules out unrelated videos so no request is made`() {
        assertFalse(catalog.covers(216_000)) // just outside the window
        assertFalse(catalog.covers(15_000)) // a pre-roll ad
        assertFalse(catalog.covers(600_000))
    }

    @Test
    fun `an empty catalogue covers nothing`() {
        assertFalse(Catalog().covers(214_000))
    }

    @Test
    fun `parses the server payload`() {
        val body = """
            {"version":1,"durationWindowMs":1500,"count":2,
             "entries":[{"d":10005,"t":"a","c":"b"},{"d":214000,"t":"c"}]}
        """.trimIndent()
        val parsed = PcfParser.json.decodeFromString(Catalog.serializer(), body)
        assertTrue(parsed.covers(214_000))
        assertFalse(parsed.covers(50_000))
    }
}
