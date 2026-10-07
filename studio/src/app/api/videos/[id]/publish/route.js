// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { ok, parseBody, route } from "@/lib/http/respond";
import { publishVideo } from "@/lib/videos/repo";
import { publishSchema } from "@/lib/videos/schemas";

export const POST = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  const body =
    req.headers.get("content-length") === "0" || !req.body
      ? {}
      : await parseBody(req, publishSchema);
  return ok(await publishVideo(id, body.sheetVersion));
});
