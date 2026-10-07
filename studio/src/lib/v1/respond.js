// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { NextResponse } from "next/server";
import { notFound } from "../http/errors.js";
import { buildPcfDocument } from "../pcf/document.js";
import { activeSheetFor } from "../matching/match.js";
import { getStorage } from "../storage/index.js";

const CACHE_CONTROL = "public, max-age=60";

export const etagFor = (video, sheet) => `"${video.youtubeVideoId}:${sheet.sheetVersion}"`;

export async function respondWithSheet(req, video, extra = {}) {
  const sheet = await activeSheetFor(video.id);
  if (!sheet) throw notFound("cue sheet");
  const etag = etagFor(video, sheet);
  const headers = { ETag: etag, "Cache-Control": CACHE_CONTROL };
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  const body = { ...extra, sheet: buildPcfDocument(video, sheet) };
  return NextResponse.json(body, { headers });
}

export async function logResolve({ title, channel, durationMs, matchedId = null, confidence = null }) {
  try {
    return await getStorage().logResolve({ title, channel, durationMs, matchedId, confidence });
  } catch {
    // Non-blocking log write
  }
}
