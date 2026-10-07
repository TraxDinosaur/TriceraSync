// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 TraxDinosaur

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "TriceraSync Engine"
include(":app")
