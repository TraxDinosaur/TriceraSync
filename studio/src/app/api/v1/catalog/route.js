// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/rateLimit";
import { route } from "@/lib/http/respond";
import { catalogEntries } from "@/lib/matching/match";
import { DURATION_WINDOW_MS } from "@/lib/matching/match";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalog — everything the Engine needs to answer "could this video have a sheet?"
 * offline. Entries are normalized title / channel / duration only; the Engine gates on the
 * duration window first, so playing an unrelated video never costs a request (PRD NFR battery).
 */
export const GET = route(async (req) => {
  rateLimit(req);
  const rows = await catalogEntries();
  const latest = rows.reduce((max, r) => Math.max(max, new Date(r.u).getTime()), 0);
  const etag = `"catalog:${rows.length}:${latest}"`;
  const headers = { ETag: etag, "Cache-Control": "public, max-age=300" };
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(
    {
      version: 1,
      durationWindowMs: DURATION_WINDOW_MS,
      count: rows.length,
      entries: rows.map(({ d, t, c }) => ({ d, t, c })),
    },
    { headers },
  );
});
