// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.actuators

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The pulse floor is what stops short cues being silently dropped on slow hardware, so it is
 * worth pinning down. It reads what the device reports rather than a list of brands — see
 * [minPulseFor].
 */
class VibrateFloorTest {

    @Test
    fun `a fast LRA motor keeps pulses short`() {
        assertEquals(25L, minPulseFor("Google", "google", hasAmplitudeControl = true))
        assertEquals(25L, minPulseFor("samsung", "samsung", hasAmplitudeControl = true))
        assertEquals(25L, minPulseFor("OnePlus", "OnePlus", hasAmplitudeControl = true))
    }

    @Test
    fun `no amplitude control means an ERM motor, which needs longer`() {
        assertEquals(40L, minPulseFor("Xiaomi", "Redmi", hasAmplitudeControl = false))
        assertEquals(40L, minPulseFor("realme", "realme", hasAmplitudeControl = false))
        assertEquals(40L, minPulseFor("", "", hasAmplitudeControl = false))
    }

    @Test
    fun `brands confirmed to drop short effects get the longest floor either way`() {
        assertEquals(45L, minPulseFor("motorola", "motorola", hasAmplitudeControl = true))
        assertEquals(45L, minPulseFor("Motorola", "MOTOROLA", hasAmplitudeControl = false))
        assertEquals(45L, minPulseFor("Lenovo", "lenovo", hasAmplitudeControl = true))
    }

    @Test
    fun `the floor stays within a sane band for every combination`() {
        val brands = listOf("Google", "samsung", "motorola", "Lenovo", "Xiaomi", "", "unknown")
        for (b in brands) {
            for (amp in listOf(true, false)) {
                val floor = minPulseFor(b, b, amp)
                assertTrue(floor in 25L..45L, "floor for $b amp=$amp was $floor")
            }
        }
    }
}
