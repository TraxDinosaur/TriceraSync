// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

/** Public links shown in the chrome. Override the repo URL per deployment if the showcase moves. */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/TraxDinosaur/TriceraSync";
export const APK_URL = `${GITHUB_URL}/raw/main/release/tricerasync-engine.apk`;
