// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { notFound, notFoundMessage } from "@/lib/http/errors";
import { rateLimit } from "@/lib/http/rateLimit";
import { route } from "@/lib/http/respond";
import { findPublishedByYouTubeId } from "@/lib/matching/match";
import { parseYouTubeVideoId } from "@/lib/youtube/parseUrl";
import { respondWithSheet } from "@/lib/v1/respond";

/** GET /api/v1/cue-sheets/:youtubeVideoId — direct lookup when the Engine knows the id (FR-22). */
export const GET = route(async (req, { params }) => {
  rateLimit(req);
  const { videoId } = await params;
  const id = parseYouTubeVideoId(videoId);
  if (!id) throw notFound("video");
  const video = await findPublishedByYouTubeId(id);
  if (!video) throw notFoundMessage("no TriceraSync sheet for this video");
  return respondWithSheet(req, video, { match: { videoId: id, confidence: "id" } });
});
