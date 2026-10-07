// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { create } from "zustand";
import { computePeaks } from "@/lib/audio/waveform";

// ponytail: in-memory cache keyed by file metadata; upgrade to IndexedDB if persistence across browser restarts is needed.
const cache = new Map();

export const useWaveformStore = create((set, get) => ({
  status: "idle", // "idle" | "decoding" | "ready" | "error"
  error: null,
  peaks: null,
  audioBuffer: null,
  durationSec: 0,
  peaksPerSec: 50,
  previewMarkers: null,
  setPreviewMarkers: (previewMarkers) => set({ previewMarkers }),

  async loadFromFile(file) {
    if (!file) {
      set({ status: "idle", peaks: null, audioBuffer: null, durationSec: 0, error: null });
      return;
    }

    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (cache.has(key)) {
      const cached = cache.get(key);
      set({
        status: "ready",
        peaks: cached.peaks,
        audioBuffer: cached.audioBuffer,
        durationSec: cached.durationSec,
        error: null,
      });
      return;
    }

    set({ status: "decoding", error: null });

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio API not supported in this browser");

      const ctx = new AudioCtx();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();

      const peaksPerSec = get().peaksPerSec;
      const peaks = computePeaks(audioBuffer.getChannelData(0), audioBuffer.duration, peaksPerSec);
      const result = { peaks, audioBuffer, durationSec: audioBuffer.duration };
      cache.set(key, result);

      set({ status: "ready", peaks, audioBuffer, durationSec: audioBuffer.duration, error: null });
    } catch (err) {
      set({
        status: "error",
        error: err.message || "Failed to decode audio",
        peaks: null,
        audioBuffer: null,
      });
    }
  },
}));
