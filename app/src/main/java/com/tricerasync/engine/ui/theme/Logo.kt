// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The TriceraSync mark — three triceratops horns swept into a play triangle. Same 48×48 grid as the
 * web favicon and the launcher icon, so the three stay identical.
 */
@Composable
fun LogoMark(size: Dp = 40.dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val u = this.size.minDimension / 48f
        val brush = Brush.linearGradient(
            colors = listOf(LogoLight, LogoDeep),
            start = Offset(8f * u, 10f * u),
            end = Offset(40f * u, 38f * u),
        )

        // Each horn is a tapered quadratic sliver: thick base on the left, point on the right.
        claw(u, brush, 8f, 9f, 17f, 9f, 26f, 18f, 17f, 15f, 8f, 15f)
        claw(u, brush, 8f, 20.5f, 24.5f, 20.5f, 41f, 24f, 24.5f, 27.5f, 8f, 27.5f)
        claw(u, brush, 8f, 33f, 17f, 33f, 26f, 30f, 17f, 39f, 8f, 39f)
    }
}

@Suppress("LongParameterList")
private fun androidx.compose.ui.graphics.drawscope.DrawScope.claw(
    u: Float,
    brush: Brush,
    x0: Float, y0: Float,
    cx1: Float, cy1: Float,
    tx: Float, ty: Float,
    cx2: Float, cy2: Float,
    x1: Float, y1: Float,
) {
    drawPath(
        Path().apply {
            moveTo(x0 * u, y0 * u)
            quadraticTo(cx1 * u, cy1 * u, tx * u, ty * u)
            quadraticTo(cx2 * u, cy2 * u, x1 * u, y1 * u)
            close()
        },
        brush,
    )
}
