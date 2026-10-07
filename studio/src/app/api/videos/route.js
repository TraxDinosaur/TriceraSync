// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { created, ok, parseBody, route } from "@/lib/http/respond";
import { createVideo, listVideos } from "@/lib/videos/repo";
import { createVideoSchema } from "@/lib/videos/schemas";
import { resolveYouTubeMetadata } from "@/lib/youtube/metadata";

export const GET = route(async (req) => {
  requireDemoToken(req);
  return ok(await listVideos());
});

export const POST = route(async (req) => {
  requireDemoToken(req);
  const body = await parseBody(req, createVideoSchema);
  const youtube =
    body.source === "youtube"
      ? await resolveYouTubeMetadata(body.youtubeUrl, body.durationMs)
      : undefined;
  return created(await createVideo({ ...body, youtube }));
});
