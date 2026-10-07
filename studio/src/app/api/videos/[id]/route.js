// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { noContent, ok, parseBody, route } from "@/lib/http/respond";
import { serializeCueSheet } from "@/lib/pcf/document";
import { deleteVideo, getCueSheet, getVideo, updateVideo } from "@/lib/videos/repo";
import { updateVideoSchema } from "@/lib/videos/schemas";
import { resolveYouTubeMetadata } from "@/lib/youtube/metadata";

export const GET = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  const video = await getVideo(id);
  const sheet = (await getCueSheet(id, { preferActive: true })) ?? (await getCueSheet(id));
  return ok({ ...video, cueSheet: sheet ? serializeCueSheet(sheet) : null });
});

export const PATCH = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  const body = await parseBody(req, updateVideoSchema);
  const youtube = body.youtubeUrl
    ? await resolveYouTubeMetadata(body.youtubeUrl, body.durationMs)
    : undefined;
  return ok(await updateVideo(id, { ...body, youtube }));
});

export const DELETE = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  await deleteVideo(id);
  return noContent();
});
