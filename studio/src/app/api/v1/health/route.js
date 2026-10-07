// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { ok, route } from "@/lib/http/respond";
import { PCF_VERSION } from "@/lib/pcf/schema";
import { getStorage } from "@/lib/storage/index";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  let storageStatus = "ok";
  try {
    await getStorage().listVideos();
  } catch {
    storageStatus = "unreachable";
  }
  return ok({
    ok: storageStatus === "ok",
    version: "0.1.0",
    pcfVersion: PCF_VERSION,
    storage: storageStatus,
  });
});
