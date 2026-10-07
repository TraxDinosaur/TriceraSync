// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { computePeaks } from "../audio/waveform.js";

describe("waveform computePeaks", () => {
  test("handles empty or invalid data gracefully", () => {
    expect(computePeaks(null, 0).length).toBe(0);
    expect(computePeaks(new Float32Array(0), 10).length).toBe(0);
    expect(computePeaks(new Float32Array(100), 0).length).toBe(0);
  });

  test("produces normalized peaks between 0 and 1", () => {
    // 1 second of audio at 1000 Hz, sample rate 1000 samples/sec
    const samples = new Float32Array(1000);
    // Add a peak at 500ms
    samples[500] = 0.8;
    samples[501] = -0.4;

    const peaks = computePeaks(samples, 1, 10); // 10 peaks per second
    expect(peaks.length).toBe(10);
    // Peak at index 5 should be normalized to 1.0 (since 0.8 was the max)
    expect(peaks[5]).toBe(1.0);
    // Silence sections should be 0
    expect(peaks[0]).toBe(0);
  });

  test("all zeros stays zero without dividing by zero", () => {
    const samples = new Float32Array(100);
    const peaks = computePeaks(samples, 1, 10);
    expect(peaks.length).toBe(10);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });
});
