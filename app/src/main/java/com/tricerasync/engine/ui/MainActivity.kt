// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

package com.tricerasync.engine.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.tricerasync.engine.ui.home.HomeScreen
import com.tricerasync.engine.ui.theme.TriceraSyncTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TriceraSyncTheme {
                Scaffold { padding ->
                    Box(Modifier.fillMaxSize().padding(padding)) {
                        HomeScreen()
                    }
                }
            }
        }
    }
}
