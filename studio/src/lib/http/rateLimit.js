// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { HttpError } from "./errors.js";

/**
 * In-memory token bucket per client IP (PRD §11: 60 req/min on /v1/*). Good enough for a
 * single-instance demo; swap for a shared store before running multiple instances.
 */
const buckets = new Map();
const CAPACITY = 60;
const REFILL_PER_MS = CAPACITY / 60_000;
const SWEEP_EVERY = 5 * 60_000;
let lastSweep = Date.now();

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function rateLimit(req) {
  const now = Date.now();
  if (now - lastSweep > SWEEP_EVERY) {
    for (const [ip, b] of buckets) if (now - b.at > SWEEP_EVERY) buckets.delete(ip);
    lastSweep = now;
  }
  const ip = clientIp(req);
  const b = buckets.get(ip) ?? { tokens: CAPACITY, at: now };
  b.tokens = Math.min(CAPACITY, b.tokens + (now - b.at) * REFILL_PER_MS);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    throw new HttpError(429, "rate_limited", "too many requests");
  }
  b.tokens -= 1;
  buckets.set(ip, b);
}
