// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { LANE_HEIGHT } from "@/lib/timeline/geometry";
import { useCues } from "@/store/cueStore";
import { useTimeline } from "@/store/timelineStore";
import { CueMarker } from "./CueMarker";

const OVERSCAN_MS = 1000;

/** One row per cue type. Renders only cues inside the visible range (+ overscan) — R5. */
export function Lane({ type, fromMs, toMs, invalidIds, height }) {
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const laneHeight = useTimeline((s) => height ?? s.laneHeight ?? LANE_HEIGHT);
  const cues = useCues((s) => s.cues);
  const selection = useCues((s) => s.selection);
  const active = useCues((s) => s.activeType === type);
  const visible = cues.filter(
    (c) => c.type === type && c.at <= toMs + OVERSCAN_MS && c.at >= fromMs - OVERSCAN_MS - 60_000,
  );
  return (
    <div
      data-lane-type={type}
      className={`border-border relative border-b ${active ? "bg-accent/5" : ""}`}
      style={{ height: laneHeight }}
    >
      {visible.map((c) => (
        <CueMarker
          key={c.id}
          cue={c}
          pxPerMs={pxPerMs}
          selected={selection.has(c.id)}
          invalid={invalidIds?.has(c.id)}
        />
      ))}
    </div>
  );
}
