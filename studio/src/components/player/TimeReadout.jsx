// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { formatTime, frameIndex } from "@/lib/time/format";
import { useEditor } from "@/store/editorStore";

/** `mm:ss.mmm / mm:ss.mmm · f 1234` — re-renders at playback rate, so keep it tiny. */
export function TimeReadout() {
  const playheadMs = useEditor((s) => s.playheadMs);
  const durationMs = useEditor((s) => s.durationMs);
  const fps = useEditor((s) => s.fps);
  const withHours = (durationMs ?? 0) >= 3_600_000;
  return (
    <div className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
      <span className="text-fg">{formatTime(playheadMs, { withHours })}</span>
      <span className="text-fg-muted">/</span>
      <span className="text-fg-muted">
        {durationMs != null ? formatTime(durationMs, { withHours }) : "--:--.---"}
      </span>
      <span className="text-fg-muted ml-2 text-xs">f {frameIndex(playheadMs, fps)}</span>
    </div>
  );
}
