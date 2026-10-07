// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { RULER_HEIGHT } from "@/lib/timeline/geometry";
import { useEditor } from "@/store/editorStore";
import { useTimeline } from "@/store/timelineStore";

/** Vertical playhead line with a drag handle in the ruler. Re-renders per frame; keep tiny. */
export function Playhead() {
  const playheadMs = useEditor((s) => s.playheadMs);
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const x = playheadMs * pxPerMs;
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-30"
      style={{ transform: `translateX(${x}px)` }}
    >
      <div
        data-playhead
        className="bg-danger pointer-events-auto absolute -left-1.5 cursor-ew-resize rounded-b-sm"
        style={{ top: 0, width: 12, height: RULER_HEIGHT - 8 }}
      />
      <div className="bg-danger absolute top-0 bottom-0 w-px" />
    </div>
  );
}
