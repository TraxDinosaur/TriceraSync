// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { create } from "zustand";

/** View state of the timeline (zoom / scroll / snapping). Not part of undo history. */
export const useTimeline = create((set) => ({
  pxPerMs: 0.1, // 100 px per second until the first fit
  scrollLeft: 0,
  viewportWidth: 0,
  waveformHeight: 40,
  laneHeight: 40,
  snapGrid: true,
  snapCues: true,
  gridMs: 10,
  set,
  toggleSnapGrid: () => set((s) => ({ snapGrid: !s.snapGrid })),
  toggleSnapCues: () => set((s) => ({ snapCues: !s.snapCues })),
}));
