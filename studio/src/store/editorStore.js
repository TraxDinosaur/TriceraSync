// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { create } from "zustand";

/**
 * Playback state shared by the transport, time readout and (Phase 4) timeline.
 * Cue editing state with undo/redo is added in Phase 4.
 */
export const useEditor = create((set) => ({
  playheadMs: 0,
  playing: false,
  durationMs: null,
  fps: 30,
  rate: 1,
  preview: false,
  togglePreview: () => set((s) => ({ preview: !s.preview })),
  /** Play a short audio burst while stepping / dragging the playhead. */
  scrubAudio: true,
  toggleScrubAudio: () => set((s) => ({ scrubAudio: !s.scrubAudio })),
  setPlayhead: (playheadMs) => set({ playheadMs }),
  setPlaying: (playing) => set({ playing }),
  setDuration: (durationMs) => set({ durationMs }),
  setFps: (fps) => set({ fps }),
  setRate: (rate) => set({ rate }),
  reset: () => set({ playheadMs: 0, playing: false, durationMs: null, rate: 1 }),
}));
