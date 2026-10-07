// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { computeNovelty, detectAudioCues, pickOnsets } from "../audio/detect.js";

describe("detectAudioCues", () => {
  test("returns empty array for empty peaks or invalid rate", () => {
    expect(detectAudioCues(null)).toEqual([]);
    expect(detectAudioCues([], 50)).toEqual([]);
    expect(detectAudioCues([1, 1], 0)).toEqual([]);
  });

  test("detects isolated peaks above threshold", () => {
    // 50 peaks per sec (20ms each)
    const peaks = new Float32Array(100); // 2 seconds
    peaks[25] = 0.9; // 500 ms
    peaks[75] = 0.8; // 1500 ms

    const detected = detectAudioCues(peaks, 50, { threshold: 0.5, minGapMs: 200, mode: "peak" });
    expect(detected).toEqual([500, 1500]);
  });

  test("enforces minGapMs (debouncing) across continuous loud sections", () => {
    const peaks = new Float32Array(50); // 1 second
    // Continuous loud block from index 10 to 20 (200ms to 400ms)
    for (let i = 10; i <= 20; i++) {
      peaks[i] = 0.85;
    }
    // Middle peak
    peaks[12] = 0.95;

    const detected = detectAudioCues(peaks, 50, { threshold: 0.5, minGapMs: 500, mode: "peak" });
    // Only first local max triggers, remainder debounced
    expect(detected.length).toBe(1);
    expect(detected[0]).toBe(240); // 12 * 20ms = 240ms
  });

  test("jumpscare mode requires prior silence", () => {
    const peaks = new Float32Array(100);
    // Spike with noisy background before it
    for (let i = 0; i < 20; i++) peaks[i] = 0.45;
    peaks[25] = 0.95; // spike at index 25, but prior was noisy

    // Spike after silence
    peaks[75] = 0.95; // prior 50..74 is 0 (silent)

    const detected = detectAudioCues(peaks, 50, { threshold: 0.7, mode: "jumpscare" });
    expect(detected).toEqual([1500]); // only the second spike (75 * 20ms = 1500ms) triggers
  });
});

describe("DSP novelty and onset picking", () => {
  test("accurately detects sharp synthetic audio attacks", () => {
    const sampleRate = 44100;
    const duration = 2; // 2 seconds
    const samples = new Float32Array(sampleRate * duration);

    // Place an impulse kick attack at 0.5s (22050 samples)
    const kickIndex = 22050;
    for (let j = 0; j < 2000; j++) {
      const t = j / sampleRate;
      samples[kickIndex + j] = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 30);
    }

    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    expect(novelty.length).toBeGreaterThan(0);

    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 65,
      minGapMs: 150,
    });
    expect(onsets.length).toBe(1);
    // Expected around 500ms, accurate within 15ms
    expect(Math.abs(onsets[0] - 500)).toBeLessThanOrEqual(15);
  });
});
