// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { getStorage } from "../storage/index.js";

export async function listVideos() {
  return getStorage().listVideos();
}

export async function getVideo(id) {
  return getStorage().getVideo(id);
}

export async function getVideoByYouTubeId(youtubeVideoId) {
  return getStorage().getVideoByYouTubeId(youtubeVideoId);
}

export async function createVideo(input) {
  return getStorage().createVideo(input);
}

export async function updateVideo(id, patch) {
  return getStorage().updateVideo(id, patch);
}

export async function deleteVideo(id) {
  return getStorage().deleteVideo(id);
}

export async function saveCueSheet(videoId, input) {
  return getStorage().saveCueSheet(videoId, input);
}

export async function getCueSheet(videoId, options) {
  return getStorage().getCueSheet(videoId, options);
}

export async function listCueSheets(videoId) {
  return getStorage().listCueSheets(videoId);
}

export async function recentResolves(videoId, limit = 12) {
  return getStorage().recentResolves(videoId, limit);
}

export async function publishVideo(videoId, sheetVersion) {
  return getStorage().publishVideo(videoId, sheetVersion);
}

export async function unpublishVideo(videoId) {
  return getStorage().unpublishVideo(videoId);
}
