// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { z } from "zod";
import { notFoundMessage } from "@/lib/http/errors";
import { rateLimit } from "@/lib/http/rateLimit";
import { parseQuery, route } from "@/lib/http/respond";
import { matchVideo } from "@/lib/matching/match";
import { normalize } from "@/lib/matching/normalize";
import { logResolve, respondWithSheet } from "@/lib/v1/respond";

const querySchema = z.object({
  title: z.string().trim().min(1).max(500),
  channel: z.string().trim().max(200).optional(),
  durationMs: z.coerce.number().int().positive(),
});

/**
 * GET /api/v1/resolve?title&channel&durationMs — the Engine's entry point (PRD FR-20/21).
 * Inputs are what YouTube's MediaSession exposes; matching is by normalized title/channel
 * within a ±1.5 s duration window.
 */
export const GET = route(async (req) => {
  rateLimit(req);
  const q = parseQuery(req, querySchema);
  const titleNorm = normalize(q.title);
  const channelNorm = q.channel ? normalize(q.channel) : undefined;
  const hit = titleNorm
    ? await matchVideo({ titleNorm, channelNorm, durationMs: q.durationMs })
    : null;

  if (!hit) {
    await logResolve({ title: q.title, channel: q.channel, durationMs: q.durationMs });
    throw notFoundMessage("no TriceraSync sheet for this video");
  }
  await logResolve({
    title: q.title,
    channel: q.channel,
    durationMs: q.durationMs,
    matchedId: hit.video.id,
    confidence: hit.confidence,
  });
  return respondWithSheet(req, hit.video, {
    match: { videoId: hit.video.youtubeVideoId, confidence: hit.confidence },
  });
});
