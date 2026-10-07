// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

/** `hh:mm:ss.mmm` (hours omitted when zero unless `withHours`). */
export function formatTime(ms, { withHours = false } = {}) {
  const t = Math.max(0, Math.round(ms ?? 0));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const f = t % 1000;
  const core = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`;
  return h > 0 || withHours ? `${String(h).padStart(2, "0")}:${core}` : core;
}

/** `m:ss` for compact displays (durations in lists). */
export function formatShort(ms) {
  const t = Math.max(0, Math.round(ms ?? 0));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Zero-based frame index at a given fps. */
export const frameIndex = (ms, fps) => Math.floor((ms / 1000) * fps);

/** Milliseconds per frame. */
export const frameMs = (fps) => 1000 / fps;
