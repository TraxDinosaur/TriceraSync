// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { CUE_COLOR_VAR, cueExtentMs, isResizable } from "@/lib/pcf/defaults";
import { formatTime } from "@/lib/time/format";
import { HIT_PAD, MARKER_WIDTH } from "@/lib/timeline/geometry";

/**
 * One cue on a lane. The cue's timestamp is the marker's **left edge**, drawn as a hard 2 px
 * start line, so there is no ambiguity about where the effect fires — the body and the extent
 * bar both grow to the right of it. A few transparent pixels left of the line stay grabbable so
 * the marker is still easy to pick up (FR-08/09).
 */
export function CueMarker({ cue, pxPerMs, selected, invalid }) {
  const color = CUE_COLOR_VAR[cue.type];
  const extentPx = cueExtentMs(cue) * pxPerMs;
  const resizable = isResizable(cue);
  const bodyWidth = Math.max(MARKER_WIDTH, extentPx);

  return (
    <div
      data-cue-id={cue.id}
      role="button"
      tabIndex={-1}
      aria-label={`${cue.type} cue at ${cue.at} ms`}
      aria-pressed={selected}
      className={`absolute top-1.5 bottom-1.5 cursor-grab select-none ${selected ? "z-20" : "z-10"}`}
      style={{ left: cue.at * pxPerMs - HIT_PAD, width: bodyWidth + HIT_PAD }}
      title={`${cue.type} starts at ${formatTime(cue.at)} (${cue.at} ms)`}
    >
      {/* How long the effect lasts, growing right from the cue time. */}
      {extentPx > 0 && (
        <div
          className="absolute top-1 bottom-1 rounded-r-sm"
          style={{
            left: HIT_PAD,
            width: extentPx,
            background: color,
            opacity: resizable ? 0.3 : 0.18,
          }}
        />
      )}

      {/* Grab body, to the right of the start line. */}
      <div
        className="absolute top-0 bottom-0 rounded-r-sm"
        style={{
          left: HIT_PAD,
          width: MARKER_WIDTH,
          background: color,
          opacity: selected ? 0.95 : 0.7,
        }}
      />

      {/* The cue time itself. */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: HIT_PAD,
          width: 2,
          background: invalid ? "var(--danger)" : color,
          boxShadow: selected ? `0 0 0 1px var(--bg), 0 0 6px 1px ${color}` : "none",
        }}
      />

      {selected && (
        <span
          className="text-fg bg-bg-elev-2 border-border pointer-events-none absolute -top-0.5 rounded border px-1 font-mono text-[10px] whitespace-nowrap"
          style={{ left: HIT_PAD + MARKER_WIDTH + 3 }}
        >
          {formatTime(cue.at)}
        </span>
      )}

      {resizable && extentPx > MARKER_WIDTH && (
        <div
          data-cue-id={cue.id}
          data-handle="resize"
          className="absolute top-0 bottom-0 w-2 cursor-ew-resize"
          style={{ left: HIT_PAD + extentPx - 4 }}
        />
      )}
    </div>
  );
}
