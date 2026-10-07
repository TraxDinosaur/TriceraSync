// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Audio onset and spectral transient detection for Smart Cue generation.
// Uses native Biquad filtering (OfflineAudioContext) and Half-Wave Rectified Log-Energy Flux.

/**
 * Filter an AudioBuffer using browser OfflineAudioContext.
 * @param {AudioBuffer} audioBuffer
 * @param {'lowpass'|'bandpass'|'highpass'} type
 * @param {number} frequency - Cutoff / center frequency in Hz
 * @param {number} [q=1.0]
 * @returns {Promise<Float32Array>} Mono filtered PCM samples
 */
export async function filterAudioBuffer(audioBuffer, type = "lowpass", frequency = 140, q = 1.0) {
  const OfflineCtx =
    typeof window !== "undefined"
      ? window.OfflineAudioContext || window.webkitOfflineAudioContext
      : null;
  if (!OfflineCtx) {
    return audioBuffer.getChannelData(0);
  }

  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const offline = new OfflineCtx(1, length, sampleRate);

  const source = offline.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offline.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  source.connect(filter);
  filter.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Computes the half-wave rectified logarithmic energy novelty curve.
 * Frame size N=512, hop size H=256 gives ~5.8ms time resolution at 44.1kHz.
 */
export function computeNovelty(samples, N = 512, H = 256, gamma = 100) {
  const totalFrames = Math.floor((samples.length - N) / H);
  if (totalFrames <= 0)
    return { novelty: new Float32Array(0), rawEnergy: new Float32Array(0), totalFrames: 0 };

  const logEnergy = new Float32Array(totalFrames);
  const rawEnergy = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * H;
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const val = samples[offset + j];
      sum += val * val;
    }
    rawEnergy[i] = sum;
    logEnergy[i] = Math.log(1 + gamma * sum);
  }

  const novelty = new Float32Array(totalFrames);
  for (let i = 1; i < totalFrames; i++) {
    const diff = logEnergy[i] - logEnergy[i - 1];
    if (diff > 0) novelty[i] = diff;
  }

  return { novelty, rawEnergy, totalFrames };
}

/**
 * Peak-picking with adaptive moving threshold on novelty curve.
 * @param {Float32Array} novelty
 * @param {Float32Array} rawEnergy
 * @param {number} sampleRate
 * @param {number} H - Hop size
 * @param {Object} options
 * @param {number} [options.sensitivity=65] - 10..95
 * @param {number} [options.minGapMs=180] - Debounce interval
 * @param {'subbass'|'action'|'jumpscare'|'all'} [options.mode='subbass']
 * @param {number} [options.maxCues=2000]
 * @param {number} [options.minNovelty=0.45]
 * @returns {number[]} Timestamps in milliseconds
 */
export function pickOnsets(novelty, rawEnergy, sampleRate, H = 256, options = {}) {
  const totalFrames = novelty.length;
  if (totalFrames === 0 || sampleRate <= 0) return [];

  const sensitivity = Math.max(10, Math.min(95, options.sensitivity ?? 65));
  const minGapMs = Math.max(60, options.minGapMs ?? 180);
  const mode = options.mode ?? "subbass";
  const maxCues = Math.max(1, options.maxCues ?? 2000);
  const minNovelty = options.minNovelty ?? 0.45;

  // Multiplier lambda: sensitivity 10 => 3.8 (very strict), 95 => 0.5 (sensitive)
  const lambda = Math.max(0.4, 4.0 - (sensitivity / 100) * 3.6);
  const minGapFrames = Math.ceil((minGapMs / 1000) * (sampleRate / H));
  const minEnergy = 0.0001 * 512; // ignore absolute silence / background hiss

  const windowRadius = Math.max(10, Math.round(0.18 * (sampleRate / H))); // ~180ms rolling window
  const onsets = [];
  let lastOnsetFrame = -minGapFrames;

  for (let i = 1; i < totalFrames - 1; i++) {
    const nov = novelty[i];
    if (nov < minNovelty) continue;
    if (i - lastOnsetFrame < minGapFrames) continue;
    if (rawEnergy[i] < minEnergy) continue;

    // Peak condition: must be local crest
    if (nov < novelty[i - 1] || nov <= novelty[i + 1]) continue;

    // Calculate local mean and standard deviation
    const startK = Math.max(0, i - windowRadius);
    const endK = Math.min(totalFrames - 1, i + windowRadius);
    let sum = 0;
    const count = endK - startK + 1;
    for (let k = startK; k <= endK; k++) {
      sum += novelty[k];
    }
    const mean = sum / count;

    let varianceSum = 0;
    for (let k = startK; k <= endK; k++) {
      const d = novelty[k] - mean;
      varianceSum += d * d;
    }
    const std = Math.sqrt(varianceSum / count);
    const threshold = mean + lambda * std;

    if (nov < threshold) continue;

    // Special mode check: Horror Jump-scare requires quiet baseline in prior 400ms
    if (mode === "jumpscare") {
      const priorFrames = Math.round(0.4 * (sampleRate / H));
      let priorMax = 0;
      const start = Math.max(0, i - priorFrames);
      for (let k = start; k < i - 2; k++) {
        if (rawEnergy[k] > priorMax) priorMax = rawEnergy[k];
      }
      // Background must be genuine silence/low-level tension (amplitude < ~0.15)
      if (priorMax > 0.025 * 512 || priorMax > rawEnergy[i] * 0.05) continue;
    }

    const atMs = Math.round(((i * H) / sampleRate) * 1000);
    onsets.push(atMs);
    lastOnsetFrame = i;

    if (onsets.length >= maxCues) break;
  }

  return onsets;
}

/**
 * End-to-end Smart Cue detection on an AudioBuffer.
 * @param {AudioBuffer} audioBuffer
 * @param {Object} options
 * @param {number} [options.sensitivity=65]
 * @param {number} [options.minGapMs=180]
 * @param {'subbass'|'action'|'jumpscare'|'all'} [options.mode='subbass']
 * @returns {Promise<number[]>} Timestamps in ms
 */
export async function detectSmartCues(audioBuffer, options = {}) {
  if (!audioBuffer) return [];

  const mode = options.mode ?? "subbass";
  let samples;

  if (mode === "subbass") {
    // 140Hz lowpass filter isolates kick drums, 808s, explosions, and sub-bass drops
    samples = await filterAudioBuffer(audioBuffer, "lowpass", 140, 1.2);
  } else if (mode === "action") {
    // 800Hz bandpass filter isolates gunshots, punches, and combat hits
    samples = await filterAudioBuffer(audioBuffer, "bandpass", 800, 0.8);
  } else {
    // Full spectrum
    samples = audioBuffer.getChannelData(0);
  }

  const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
  return pickOnsets(novelty, rawEnergy, audioBuffer.sampleRate, 256, options);
}

/** Legacy / fallback peak envelope detection */
export function detectAudioCues(peaks, peaksPerSec = 50, options = {}) {
  if (!peaks || peaks.length === 0 || peaksPerSec <= 0) return [];

  const threshold = Math.max(0.05, Math.min(1.0, options.threshold ?? 0.6));
  const minGapMs = Math.max(50, options.minGapMs ?? 200);
  const mode = options.mode ?? "transient";
  const maxCues = Math.max(1, options.maxCues ?? 2000);

  const minGapSamples = Math.ceil((minGapMs / 1000) * peaksPerSec);
  const detectedMs = [];
  let lastSampleIdx = -minGapSamples;

  const len = peaks.length;
  const historyLen = Math.max(2, Math.round(0.3 * peaksPerSec));

  for (let i = 0; i < len; i++) {
    const val = peaks[i];
    if (val < threshold) continue;
    if (i - lastSampleIdx < minGapSamples) continue;

    const prev = i > 0 ? peaks[i - 1] : 0;
    const next = i < len - 1 ? peaks[i + 1] : 0;
    if (val < prev || val <= next) continue;

    if (mode === "transient") {
      let sum = 0;
      let count = 0;
      const start = Math.max(0, i - historyLen);
      for (let j = start; j < i; j++) {
        sum += peaks[j];
        count++;
      }
      const baseline = count > 0 ? sum / count : 0;
      if (val - baseline < 0.15 * threshold) continue;
    } else if (mode === "jumpscare") {
      const silenceWindow = Math.max(5, Math.round(0.5 * peaksPerSec));
      const start = Math.max(0, i - silenceWindow);
      let priorMax = 0;
      for (let j = start; j < i; j++) {
        if (peaks[j] > priorMax) priorMax = peaks[j];
      }
      if (priorMax > 0.3) continue;
    }

    const atMs = Math.round((i / peaksPerSec) * 1000);
    detectedMs.push(atMs);
    lastSampleIdx = i;

    if (detectedMs.length >= maxCues) break;
  }

  return detectedMs;
}
