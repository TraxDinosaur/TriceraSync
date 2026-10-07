// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { computeNovelty, pickOnsets, detectAudioCues } from "../audio/detect.js";
import { computePeaks } from "../audio/waveform.js";

describe("Smart Cue Comprehensive DSP & Transient Tests", () => {
  const sampleRate = 44100;

  // 1. Synthetic Sub-Bass Pattern: 4 distinct 50Hz sine sub-bass drops
  test("accurately identifies multiple sub-bass drop attack timestamps", () => {
    const duration = 6; // 6 seconds
    const samples = new Float32Array(sampleRate * duration);
    const dropTimes = [1.2, 2.4, 3.6, 4.8]; // exact seconds

    for (const t of dropTimes) {
      const start = Math.floor(t * sampleRate);
      for (let i = 0; i < 4410; i++) {
        // 100ms burst
        const sec = i / sampleRate;
        const decay = Math.exp(-sec * 20);
        samples[start + i] = Math.sin(2 * Math.PI * 50 * sec) * decay * 0.95;
      }
    }

    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 60,
      minGapMs: 200,
      mode: "subbass",
    });

    expect(onsets.length).toBe(4);
    for (let k = 0; k < dropTimes.length; k++) {
      const expectedMs = Math.round(dropTimes[k] * 1000);
      expect(Math.abs(onsets[k] - expectedMs)).toBeLessThanOrEqual(15);
    }
  });

  // 2. Reject Steady High-Volume Ambient Drone (No Attack)
  test("does not trigger on continuous loud static / drone without transient attacks", () => {
    const duration = 2;
    const samples = new Float32Array(sampleRate * duration);
    // Steady loud sine wave (drone)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 200 * (i / sampleRate)) * 0.8;
    }

    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    // Only the very initial start might have an attack, after that it's steady
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 50,
      minGapMs: 150,
    });

    // Steady drone must NOT generate recurring false cues throughout the 2 seconds
    const middleOnsets = onsets.filter((t) => t > 300);
    expect(middleOnsets.length).toBe(0);
  });

  // 3. Jump-scare: Silence followed by sudden loud spike
  test("jump-scare mode triggers on spike after silence but ignores spike in loud section", () => {
    const duration = 4;
    const samples = new Float32Array(sampleRate * duration);

    // Section 1: Loud continuous noise + spike at 1.0s
    for (let i = 0; i < sampleRate * 1.5; i++) {
      samples[i] = (Math.random() - 0.5) * 0.6; // loud noise
    }
    // Spike inside noisy section
    const noisySpike = Math.floor(1.0 * sampleRate);
    for (let i = 0; i < 1000; i++) samples[noisySpike + i] = 1.0;

    // Section 2: Pure silence 1.5s to 3.0s, then sudden jump-scare spike at 3.0s
    const scareSpike = Math.floor(3.0 * sampleRate);
    for (let i = 0; i < 1000; i++) samples[scareSpike + i] = 1.0;

    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 70,
      minGapMs: 200,
      mode: "jumpscare",
    });

    // Should detect the true scare at ~3000ms
    expect(onsets.some((t) => Math.abs(t - 3000) <= 20)).toBe(true);
    // Should NOT flag the spike inside the already-loud noisy section
    expect(onsets.some((t) => Math.abs(t - 1000) <= 20)).toBe(false);
  });

  // 4. Sensitivity monotonicity: Higher sensitivity returns >= cue count of lower sensitivity
  test("higher sensitivity returns superset or equal count of lower sensitivity", () => {
    const duration = 3;
    const samples = new Float32Array(sampleRate * duration);
    // 5 hits of varying amplitudes: 0.3, 0.5, 0.7, 0.85, 1.0
    const amps = [0.3, 0.5, 0.7, 0.85, 1.0];
    amps.forEach((amp, idx) => {
      const start = Math.floor((0.4 + idx * 0.5) * sampleRate);
      for (let i = 0; i < 1500; i++) {
        const sec = i / sampleRate;
        samples[start + i] = Math.sin(2 * Math.PI * 100 * sec) * Math.exp(-sec * 25) * amp;
      }
    });

    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const lowSens = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 25,
      minGapMs: 150,
    });
    const midSens = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 55,
      minGapMs: 150,
    });
    const highSens = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 85,
      minGapMs: 150,
    });

    expect(lowSens.length).toBeLessThanOrEqual(midSens.length);
    expect(midSens.length).toBeLessThanOrEqual(highSens.length);
  });

  // 5. Rejection of steady tone across frequencies at default sensitivity 65
  test("rejects continuous sine tones across frequencies without attacks at sensitivity 65", () => {
    for (const freq of [50, 60, 100, 440]) {
      const samples = new Float32Array(sampleRate * 4);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.8;
      }
      const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
      const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
        sensitivity: 65,
        minGapMs: 180,
      });
      const middleOnsets = onsets.filter((t) => t > 300);
      expect(middleOnsets.length).toBe(0);
    }
  });

  // 6. Detect subtle/quiet transient attacks (low amplitude)
  test("detects quiet kicks (amplitude 0.05) that film audio often exhibits", () => {
    const samples = new Float32Array(sampleRate * 2);
    const start = Math.floor(0.5 * sampleRate);
    for (let i = 0; i < 2000; i++) {
      const sec = i / sampleRate;
      samples[start + i] = Math.sin(2 * Math.PI * 60 * sec) * Math.exp(-sec * 30) * 0.05;
    }
    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 65,
      minGapMs: 180,
    });
    expect(onsets.length).toBe(1);
    expect(Math.abs(onsets[0] - 500)).toBeLessThanOrEqual(25);
  });

  // 7. Detect early attack in the first 100ms
  test("detects early transient attacks in the initial audio window (<100ms)", () => {
    const samples = new Float32Array(sampleRate * 1);
    const start = Math.floor(0.06 * sampleRate); // 60ms
    for (let i = 0; i < 2000; i++) {
      const sec = i / sampleRate;
      samples[start + i] = Math.sin(2 * Math.PI * 60 * sec) * Math.exp(-sec * 30) * 0.8;
    }
    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 65,
      minGapMs: 180,
    });
    expect(onsets.length).toBe(1);
    expect(Math.abs(onsets[0] - 60)).toBeLessThanOrEqual(20);
  });

  // 8. Cap higher than 250 allows long audio beat tracks to detect full range
  test("detects over 250 cues in continuous beat sequences without premature truncation", () => {
    const count = 300;
    const intervalSec = 0.1;
    const samples = new Float32Array(Math.floor(sampleRate * (count * intervalSec + 1)));
    for (let b = 0; b < count; b++) {
      const start = Math.floor((b * intervalSec + 0.1) * sampleRate);
      for (let i = 0; i < 500; i++) {
        const sec = i / sampleRate;
        samples[start + i] = Math.sin(2 * Math.PI * 120 * sec) * Math.exp(-sec * 40) * 0.8;
      }
    }
    const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
    const onsets = pickOnsets(novelty, rawEnergy, sampleRate, 256, {
      sensitivity: 65,
      minGapMs: 80,
    });
    expect(onsets.length).toBeGreaterThan(250);
  });
});
