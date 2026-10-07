// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.core.log

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** One line in the in-app log (PRD FR-28). */
data class LogLine(val at: Long, val tag: String, val message: String) {
    fun format(): String = "${TIME.format(Date(at))} [$tag] $message"

    private companion object {
        val TIME = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    }
}

/** Bounded in-memory log mirrored to logcat. Observed by the Logs screen. */
object RingLog {
    private const val CAPACITY = 2000
    private val lines = ArrayDeque<LogLine>(CAPACITY)
    private val _flow = MutableStateFlow<List<LogLine>>(emptyList())
    val flow: StateFlow<List<LogLine>> = _flow

    @Synchronized
    fun log(tag: String, message: String) {
        Log.d("TriceraSync/$tag", message)
        if (lines.size >= CAPACITY) lines.removeFirst()
        lines.addLast(LogLine(System.currentTimeMillis(), tag, message))
        _flow.value = lines.toList()
    }

    @Synchronized
    fun clear() {
        lines.clear()
        _flow.value = emptyList()
    }

    fun dump(): String = _flow.value.joinToString("\n") { it.format() }
}
