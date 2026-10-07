// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { ok, parseBody, route } from "@/lib/http/respond";
import { metadataRequestSchema } from "@/lib/videos/schemas";
import { resolveYouTubeMetadata } from "@/lib/youtube/metadata";

/** Preview metadata for a URL before linking it (PRD FR-16). */
export const POST = route(async (req) => {
  requireDemoToken(req);
  const { youtubeUrl, durationMs } = await parseBody(req, metadataRequestSchema);
  return ok(await resolveYouTubeMetadata(youtubeUrl, durationMs));
});
