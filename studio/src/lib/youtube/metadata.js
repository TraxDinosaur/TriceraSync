// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { badRequest, notFound } from "../http/errors.js";
import { fetchDataApi } from "./dataApi.js";
import { fetchOEmbed } from "./oembed.js";
import { parseYouTubeVideoId } from "./parseUrl.js";

/** Data API duration wins over the client's value only if they disagree by more than this. */
const DURATION_OVERRIDE_MS = 1500;

/**
 * Resolves a YouTube URL to the metadata we store as the Engine's match key (PRD FR-16).
 * Works without an API key; `clientDurationMs` (from <video>.duration or player.getDuration())
 * is the primary duration source.
 * @param {string} youtubeUrl
 * @param {number | null | undefined} clientDurationMs
 */
export async function resolveYouTubeMetadata(youtubeUrl, clientDurationMs) {
  const videoId = parseYouTubeVideoId(youtubeUrl);
  if (!videoId) throw badRequest("not a recognizable YouTube video URL");

  const [oembed, data] = await Promise.all([fetchOEmbed(videoId), fetchDataApi(videoId)]);
  if (!oembed && !data) throw notFound("YouTube video (private, removed, or invalid)");

  let durationMs = clientDurationMs ?? null;
  if (data?.durationMs != null) {
    if (durationMs == null || Math.abs(durationMs - data.durationMs) > DURATION_OVERRIDE_MS) {
      durationMs = data.durationMs;
    }
  }

  return {
    videoId,
    title: data?.title || oembed?.title || "",
    channel: data?.channel || oembed?.channel || "",
    channelId: data?.channelId ?? null,
    durationMs,
    thumbnailUrl: oembed?.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    source: data ? "data-api+oembed" : "oembed",
  };
}
