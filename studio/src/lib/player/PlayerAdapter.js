// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

/**
 * Common surface for the local <video> and the YouTube IFrame player (PRD FR-05).
 * All times are integer milliseconds. Events:
 *   "ready"    ({ durationMs })
 *   "time"     (ms)             — high-frequency while playing, plus after seeks
 *   "play" | "pause" | "ended"
 *   "seeked"   (ms)
 *   "duration" (ms)             — when duration becomes known / changes
 *   "error"    (Error)
 */
export class PlayerAdapter {
  #listeners = new Map();

  /** @param {string} event @param {(payload?: any) => void} cb @returns {() => void} unsubscribe */
  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(cb);
    return () => this.#listeners.get(event)?.delete(cb);
  }

  emit(event, payload) {
    this.#listeners.get(event)?.forEach((cb) => cb(payload));
  }

  removeAllListeners() {
    this.#listeners.clear();
  }

  // --- abstract (subclasses override; parameters intentionally unused here) ----------------
  play() {}
  pause() {}
  /** @param {number} ms */
  seek(ms) {}
  /**
   * Seek, and when `audible` is set play a short burst so you can *hear* where you are while
   * stepping or dragging the playhead — the way a video editor scrubs. A no-op difference from
   * `seek()` while already playing.
   * @param {number} ms @param {boolean} audible
   */
  scrub(ms, audible = false) {
    this.seek(ms);
  }
  /** @returns {number} */
  currentTimeMs() {
    return 0;
  }
  /** @returns {number | null} null until known */
  durationMs() {
    return null;
  }
  /** @returns {boolean} */
  isPlaying() {
    return false;
  }
  /** @param {number} level 0..1 */
  setVolume(level) {}
  /** @param {number} rate e.g. 0.5, 1, 1.5, 2 */
  setRate(rate) {}
  destroy() {
    this.removeAllListeners();
  }

  togglePlay() {
    if (this.isPlaying()) this.pause();
    else this.play();
  }
}

export const clampMs = (ms, durationMs) =>
  Math.max(0, Math.min(Math.round(ms), durationMs ?? Number.MAX_SAFE_INTEGER));
