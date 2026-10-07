// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { RULER_HEIGHT, tickLabel, ticksFor } from "@/lib/timeline/geometry";
import { useTimeline } from "@/store/timelineStore";

/** Time ruler with adaptive tick density (FR-07). Pointer-down here scrubs the playhead. */
export function Ruler({ fromMs, toMs }) {
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const { major, ticks } = ticksFor(pxPerMs, fromMs, toMs);
  return (
    <div
      data-ruler
      className="border-border bg-bg-elev-2 sticky top-0 z-10 cursor-ew-resize border-b select-none"
      style={{ height: RULER_HEIGHT }}
    >
      {ticks.map((t) => (
        <div
          key={t.ms}
          className="border-fg-muted/60 absolute bottom-0 border-l"
          style={{ left: t.ms * pxPerMs, height: t.major ? 12 : 6 }}
        >
          {t.major && (
            <span className="text-fg-muted absolute bottom-3 left-1 font-mono text-[10px] whitespace-nowrap">
              {tickLabel(t.ms, major)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
