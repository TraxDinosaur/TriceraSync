// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { forbidden, unauthorized } from "./errors.js";

export const DEMO_COOKIE = "tricerasync_demo";

/**
 * Access token authentication.
 *
 * Rules:
 * - If ACCESS_TOKEN (or legacy DEMO_ACCESS_TOKEN) is set, write operations require
 *   either the `x-access-token` / `x-demo-token` header or the `tricerasync_demo` cookie.
 * - If NODE_ENV === "production" and NO token is set, refuse all write operations for safety.
 * - In local development (NODE_ENV !== "production") with no token set, all writes are permitted.
 */
export function requireDemoToken(req) {
  const token = process.env.ACCESS_TOKEN || process.env.DEMO_ACCESS_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      throw forbidden("Write operations disabled in production without ACCESS_TOKEN configured");
    }
    return; // Local development: open
  }

  const header = req.headers.get("x-access-token") || req.headers.get("x-demo-token");
  if (header === token) return;
  if (readCookie(req, DEMO_COOKIE) === token) return;

  throw unauthorized("Valid access token required");
}

export function hasDemoAccess(req) {
  try {
    requireDemoToken(req);
    return true;
  } catch {
    return false;
  }
}

function readCookie(req, name) {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
