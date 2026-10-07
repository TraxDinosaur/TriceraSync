// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mirrors the web app palette (globals.css) so both halves feel like one product.
val Bg = Color(0xFF0D0C0F)
val BgElev = Color(0xFF151318)
val BgElev2 = Color(0xFF1D1A21)
val Border = Color(0xFF2B2730)
val Fg = Color(0xFFEDE9E6)
val FgMuted = Color(0xFF9A9299)
val Accent = Color(0xFFFF6A2A)
val Success = Color(0xFF34D399)
val Warning = Color(0xFFFBBF24)
val Danger = Color(0xFFF87171)

val CueVibrate = Color(0xFFF472B6)
val CueBrightness = Color(0xFFFBBF24)
val CueVolume = Color(0xFF60A5FA)
val CueFlash = Color(0xFFF87171)
val CueTorch = Color(0xFFA3E635)

// Brand mark gradient, shared with the web favicon and the launcher icon.
val LogoLight = Color(0xFFFFB020)
val LogoDeep = Color(0xFFFF4D1F)

private val Scheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color(0xFF1A0E08),
    secondary = CueVolume,
    background = Bg,
    onBackground = Fg,
    surface = BgElev,
    onSurface = Fg,
    surfaceVariant = BgElev2,
    onSurfaceVariant = FgMuted,
    outline = Border,
    error = Danger,
)

@Composable
fun TriceraSyncTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
