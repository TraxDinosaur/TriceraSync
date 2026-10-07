// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Pure timeline math: zoom, ticks, snapping. No DOM.

export const RULER_HEIGHT = 28;
export const WAVEFORM_HEIGHT = 40;
export const LANE_HEIGHT = 40;
export const GUTTER_WIDTH = 96;
export const MARKER_WIDTH = 10;
/** Transparent grab area left of a cue's start line, so the exact timestamp stays clickable. */
export const HIT_PAD = 4;
export const SNAP_PX = 8;
export const MIN_VIEW_SPAN_MS = 1000;

const TICK_STEPS = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000,
  600_000,
];

/** Smallest major tick step whose spacing is at least `minPx` on screen. */
export function pickTickStep(pxPerMs, minPx = 80) {
  return TICK_STEPS.find((s) => s * pxPerMs >= minPx) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

/** Major/minor tick positions (ms) covering [fromMs, toMs]. */
export function ticksFor(pxPerMs, fromMs, toMs) {
  const major = pickTickStep(pxPerMs);
  const minorCandidate = major / 5;
  const minor = minorCandidate * pxPerMs >= 12 ? minorCandidate : null;
  const out = [];
  const start = Math.floor(fromMs / major) * major;
  for (let t = start; t <= toMs; t += minor ?? major) {
    if (t < 0) continue;
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    out.push({ ms: t, major: isMajor });
  }
  return { major, minor, ticks: out };
}

/** Tick label: `m:ss` for coarse steps, `m:ss.mmm` when the step is sub-second. */
export function tickLabel(ms, stepMs) {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (stepMs >= 1000) return `${m}:${String(s).padStart(2, "0")}`;
  const f = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`;
}

/** Zoom bounds for a viewport width: fit-all … 1 s across the viewport. */
export function zoomBounds(viewportPx, durationMs) {
  const min = durationMs ? viewportPx / durationMs : 0.01;
  const max = viewportPx / MIN_VIEW_SPAN_MS;
  return { min: Math.min(min, max), max };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Snap `ms` to the nearest candidate within `SNAP_PX` screen pixels.
 * @param {number} ms
 * @param {{ pxPerMs: number, grid?: number|null, points?: number[] }} opts
 */
export function snapMs(ms, { pxPerMs, grid = null, points = [] }) {
  const threshold = SNAP_PX / pxPerMs;
  let best = null;
  const consider = (candidate) => {
    const d = Math.abs(candidate - ms);
    if (d <= threshold && (best == null || d < Math.abs(best - ms))) best = candidate;
  };
  for (const p of points) consider(p);
  if (grid) consider(Math.round(ms / grid) * grid);
  return best ?? ms;
}
