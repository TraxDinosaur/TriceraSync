// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { requireDemoToken } from "@/lib/http/auth";
import { ok, route } from "@/lib/http/respond";
import { recentResolves } from "@/lib/videos/repo";

/**
 * Recent lookups seen by the public resolve API, so a creator can watch a phone hit it and
 * compare what the device sent against what this project stores (the usual cause of a miss
 * is a duration or title that drifted).
 */
export const GET = route(async (req, { params }) => {
  requireDemoToken(req);
  const { id } = await params;
  return ok(await recentResolves(id));
});
