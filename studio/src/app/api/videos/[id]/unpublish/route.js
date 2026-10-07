// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { ok, route } from "@/lib/http/respond";
import { unpublishVideo } from "@/lib/videos/repo";

export const POST = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  return ok(await unpublishVideo(id));
});
