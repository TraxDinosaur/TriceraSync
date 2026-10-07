// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.sync

import android.media.session.PlaybackState
import com.tricerasync.engine.core.pcf.Cue
import com.tricerasync.engine.core.pcf.Defaults
import com.tricerasync.engine.core.pcf.FlashParams
import com.tricerasync.engine.core.pcf.LevelParams
import com.tricerasync.engine.core.pcf.TorchParams
import com.tricerasync.engine.core.pcf.VibrateParams
import com.tricerasync.engine.core.time.FakeClock
import com.tricerasync.engine.media.PlaybackSnapshot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CueSchedulerTest {
    private val cues = listOf(
        Cue.Vibrate("c_v1", 1000, params = VibrateParams.OneShot(durationMs = 100)),
        Cue.Brightness("c_b1", 2000, durationMs = 1000, params = LevelParams(0.2f)),
        Cue.Flash("c_f1", 2500, params = FlashParams("#FF0000", durationMs = 100)),
        Cue.Volume("c_vol", 3000, params = LevelParams(0.5f)),
        Cue.Brightness("c_b2", 4000, params = LevelParams(0.8f)),
        Cue.Brightness("c_b3", 5000, durationMs = 500, params = LevelParams(0.1f)),
        Cue.Torch("c_t1", 6000, params = TorchParams(true, 150)),
    )

    private class Recorder : CueSink {
        val fired = mutableListOf<Pair<String, Long>>()
        val states = mutableListOf<String>()
        var cancels = 0
        override fun fire(cue: Cue, lateMs: Long) { fired += cue.id to lateMs }
        override fun setState(type: String, cue: Cue?) { states += "$type:${cue?.id ?: "-"}" }
        override fun cancelTimed() { cancels++ }
    }

    private fun playing(pos: Long, at: Long, speed: Float = 1f) =
        PlaybackSnapshot(PlaybackState.STATE_PLAYING, pos, speed, at)

    private fun paused(pos: Long, at: Long) =
        PlaybackSnapshot(PlaybackState.STATE_PAUSED, pos, 1f, at)

    private fun harness(offsetMs: Long = 0): Triple<CueScheduler, Recorder, FakeClock> {
        val clock = FakeClock(10_000)
        val rec = Recorder()
        return Triple(CueScheduler(cues, Defaults(), clock, rec, offsetMs), rec, clock)
    }

    /** Tick every 50 ms until the clock reaches `untilMs` (relative to session start). */
    private fun runTo(s: CueScheduler, clock: FakeClock, untilMs: Long, start: Long = 10_000) {
        while (clock.now() < start + untilMs) {
            clock.advance(50)
            s.tick()
        }
    }

    @Test
    fun `stateCueAt mirrors the web runner`() {
        assertNull(stateCueAt(cues, "brightness", 0))
        assertEquals("c_b1", stateCueAt(cues, "brightness", 2500)?.id)
        assertNull(stateCueAt(cues, "brightness", 3500))          // hold expired → baseline
        assertEquals("c_b2", stateCueAt(cues, "brightness", 4500)?.id)
        assertEquals("c_b3", stateCueAt(cues, "brightness", 5200)?.id)
        assertEquals("c_b2", stateCueAt(cues, "brightness", 5600)?.id) // held reverts to persistent
        assertEquals("c_vol", stateCueAt(cues, "volume", 99_999)?.id)
    }

    @Test
    fun `instant cues fire once, in order, with small lateness at 50 ms ticks`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 3000)
        assertEquals(listOf("c_v1", "c_f1"), rec.fired.map { it.first })
        assertTrue(rec.fired.all { it.second in 0..50 }, "late=${rec.fired}")
    }

    @Test
    fun `state cues follow the position including hold expiry`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 3500)
        assertEquals(listOf("brightness:c_b1", "brightness:-", "volume:c_vol"), rec.states)
    }

    @Test
    fun `pause freezes, cancels timed effects, and resume does not replay the gap`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 500)
        // Pause at 500 ms; the reported position matches extrapolation.
        s.onSnapshot(paused(500, clock.now()))
        assertEquals(1, rec.cancels)
        clock.advance(5000)
        s.tick()
        assertTrue(rec.fired.isEmpty())
        // Resume at 500 → c_v1 (1000) fires ~500 ms later, exactly once.
        s.onSnapshot(playing(500, clock.now()))
        runTo(s, clock, 1200, start = clock.now())
        assertEquals(listOf("c_v1"), rec.fired.map { it.first })
    }

    @Test
    fun `seek forward skips instant cues but applies state, seek back re-arms`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 200)
        // Jump to 4500 while playing.
        s.onSnapshot(playing(4500, clock.now()))
        assertEquals(1, s.seeks)
        assertTrue(rec.fired.isEmpty())
        assertTrue("brightness:c_b2" in rec.states)
        assertTrue("volume:c_vol" in rec.states)
        // Seek back to 900 → c_v1 fires again when crossed.
        s.onSnapshot(playing(900, clock.now()))
        assertEquals(2, s.seeks)
        runTo(s, clock, 300, start = clock.now())
        assertEquals(listOf("c_v1"), rec.fired.map { it.first })
        assertEquals("brightness:-", rec.states.last { it.startsWith("brightness") })
    }

    @Test
    fun `playback speed scales the timeline`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(0, clock.now(), speed = 2f))
        runTo(s, clock, 1300) // 1300 ms wall = 2600 ms media → c_v1 (1000) and c_f1 (2500) fired
        assertEquals(listOf("c_v1", "c_f1"), rec.fired.map { it.first })
    }

    @Test
    fun `small drift resyncs without counting as a seek`() {
        val (s, _, clock) = harness()
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 1000)
        s.onSnapshot(playing(1300, clock.now())) // 300 ms ahead of extrapolation
        assertEquals(0, s.seeks)
        assertEquals(1, s.driftCorrections)
    }

    @Test
    fun `reset returns every active state to baseline`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(4500, clock.now()))
        rec.states.clear()
        s.reset()
        assertEquals(setOf("brightness:-", "volume:-"), rec.states.toSet())
    }

    @Test
    fun `torch state cue with auto-off is reported once`() {
        val (s, rec, clock) = harness()
        s.onSnapshot(playing(5900, clock.now()))
        runTo(s, clock, 400)
        assertEquals(1, rec.states.count { it == "torch:c_t1" })
    }

    @Test
    fun `a negative offset fires cues earlier`() {
        val (s, rec, clock) = harness(offsetMs = -200)
        s.onSnapshot(playing(0, clock.now()))
        // c_v1 is at 1000 ms; with a -200 ms offset it should fire around 800 ms of playback.
        runTo(s, clock, 850)
        assertEquals(listOf("c_v1"), rec.fired.map { it.first })
    }

    @Test
    fun `a positive offset holds cues back`() {
        val (s, rec, clock) = harness(offsetMs = 200)
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 1100)
        assertTrue(rec.fired.isEmpty(), "should not have fired yet: ${rec.fired}")
        runTo(s, clock, 1300, start = clock.now() - 1100)
        assertEquals(listOf("c_v1"), rec.fired.map { it.first })
    }

    @Test
    fun `offset does not turn normal playback into a seek`() {
        val (s, _, clock) = harness(offsetMs = -300)
        s.onSnapshot(playing(0, clock.now()))
        runTo(s, clock, 1000)
        s.onSnapshot(playing(1000, clock.now()))
        assertEquals(0, s.seeks)
        assertEquals(0, s.driftCorrections)
    }

    @Test
    fun `positionNow reports the real position, not the shifted one`() {
        val (s, _, clock) = harness(offsetMs = -200)
        s.onSnapshot(playing(5000, clock.now()))
        assertEquals(5000, s.positionNow)
    }

    // --- regression: a session must continue from where playback is, not from where the video
    // --- was when it was first detected (see README/Bugs.md B4).

    @Test
    fun `a snapshot older than the one already held is ignored`() {
        val (s, rec, clock) = harness()
        // The session is seeded with the freshest reading once the lookup finishes: the video
        // has been playing for 800 ms by then.
        val fresh = playing(800, clock.now())
        assertTrue(s.onSnapshot(fresh))
        assertEquals(800, s.anchor)

        // The snapshot captured *before* the lookup started now arrives late.
        val stale = playing(0, clock.now() - 800)
        assertFalse(s.onSnapshot(stale), "stale snapshot must be rejected")
        assertEquals(800, s.anchor, "anchor must not be dragged back to the start")
        assertEquals(0, s.seeks, "a stale snapshot must not look like a seek")

        // Playback continues from 800 ms, so the cue at 1000 ms fires ~200 ms later — once.
        runTo(s, clock, 300, start = clock.now())
        assertEquals(listOf("c_v1"), rec.fired.map { it.first })
    }

    @Test
    fun `a snapshot with the same update time is still accepted`() {
        val (s, _, clock) = harness()
        val at = clock.now()
        assertTrue(s.onSnapshot(playing(1000, at)))
        // YouTube re-publishes metadata without changing lastPositionUpdateTime.
        assertTrue(s.onSnapshot(playing(1000, at)))
    }

    @Test
    fun `a genuine later seek is still honoured after a stale one was dropped`() {
        val (s, _, clock) = harness()
        s.onSnapshot(playing(800, clock.now()))
        s.onSnapshot(playing(0, clock.now() - 800)) // dropped
        clock.advance(1000)
        s.onSnapshot(playing(60_000, clock.now())) // real seek, newer timestamp
        assertEquals(1, s.seeks)
        assertEquals(60_000, s.anchor)
    }
}
