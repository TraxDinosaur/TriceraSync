// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { notFound } from "@/lib/http/errors";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http/respond";
import { serializeCueSheet } from "@/lib/pcf/document";
import { cueSheetInputSchema } from "@/lib/pcf/schema";
import { getCueSheet, saveCueSheet } from "@/lib/videos/repo";
import { cueSheetQuerySchema } from "@/lib/videos/schemas";

export const GET = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  const { version } = parseQuery(req, cueSheetQuerySchema);
  const sheet = await getCueSheet(id, { version });
  if (!sheet) throw notFound(version ? `cue sheet v${version}` : "cue sheet");
  return ok(serializeCueSheet(sheet));
});

export const PUT = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  const input = await parseBody(req, cueSheetInputSchema);
  return created(serializeCueSheet(await saveCueSheet(id, input)));
});
