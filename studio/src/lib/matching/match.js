// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { getStorage } from "../storage/index.js";

export const DURATION_WINDOW_MS = 1500;
export const FUZZY_THRESHOLD = 0.85;

export async function catalogEntries() {
  return getStorage().catalogEntries();
}

export async function matchVideo({ titleNorm, channelNorm, durationMs }) {
  return getStorage().matchVideo({ titleNorm, channelNorm, durationMs });
}

export async function findPublishedByYouTubeId(youtubeVideoId) {
  return getStorage().findPublishedByYouTubeId(youtubeVideoId);
}

export async function activeSheetFor(videoId) {
  return getStorage().activeSheetFor(videoId);
}
