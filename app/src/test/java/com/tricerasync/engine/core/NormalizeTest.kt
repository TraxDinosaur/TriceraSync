// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core

import com.tricerasync.engine.core.matching.Normalize
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals

/** Runs the shared vectors from the App repo — parity is a hard requirement (FR-08). */
class NormalizeTest {
    private val vectors = javaClass.getResourceAsStream("/normalize-vectors.json")!!
        .bufferedReader().readText()
        .let { Json.parseToJsonElement(it).jsonObject["vectors"]!!.jsonArray }
        .map { it.jsonObject["in"]!!.jsonPrimitive.content to it.jsonObject["out"]!!.jsonPrimitive.content }

    @Test
    fun `all shared vectors match`() {
        for ((input, expected) in vectors) {
            assertEquals(expected, Normalize.normalize(input), "input=$input")
        }
    }

    @Test
    fun `idempotent`() {
        for ((_, expected) in vectors) assertEquals(expected, Normalize.normalize(expected))
    }

    @Test
    fun `null and blank`() {
        assertEquals("", Normalize.normalize(null))
        assertEquals("", Normalize.normalize(""))
        assertEquals("", Normalize.normalize("   \t "))
    }

    @Test
    fun `non-breaking and ideographic spaces collapse like JS`() {
        assertEquals("a b", Normalize.normalize("a  b"))
        assertEquals("a b", Normalize.normalize("a　b"))
    }
}
