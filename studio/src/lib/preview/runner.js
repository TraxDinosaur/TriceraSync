// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// In-browser mirror of the Engine's firing rules (PRD §8.3) used by preview mode.
// Pure logic: feed it time updates, it reports instant-cue fires and state-cue values.
import { INSTANT_CUE_TYPES, STATE_CUE_TYPES } from "../pcf/schema.js";

/**
 * Effective value of a state cue type at time `t`:
 * the last cue of that type with `at ≤ t`; a cue with `durationMs` only counts while
 * `t < at + durationMs`, after which the previous persistent cue (or baseline = null) applies.
 * @returns {object | null} the active cue or null for baseline
 */
export function stateCueAt(cues, type, t) {
  let persistent = null;
  let held = null;
  for (const c of cues) {
    if (c.type !== type || c.at > t) continue;
    if (c.durationMs != null) {
      held = t < c.at + c.durationMs ? c : null;
    } else {
      persistent = c;
      held = null;
    }
  }
  return held ?? persistent;
}

/**
 * Drives cue firing from a stream of playhead positions.
 *   runner.tick(posMs)  — while playing; fires instant cues in (lastPos, pos]
 *   runner.seek(posMs)  — jump without firing instant cues (they are never replayed)
 *   runner.reset()      — clear state (video change / preview off)
 * Callbacks: onFire(cue), onState(type, cue|null)
 */
export class CueRunner {
  #cues = [];
  #lastPos = null;
  #state = Object.fromEntries(STATE_CUE_TYPES.map((t) => [t, null]));
  onFire = () => {};
  onState = () => {};

  constructor({ onFire, onState } = {}) {
    if (onFire) this.onFire = onFire;
    if (onState) this.onState = onState;
  }

  /** Replace the cue set (already sorted by `at`). Re-evaluates state at the current position. */
  setCues(cues) {
    this.#cues = cues;
    if (this.#lastPos != null) this.#syncState(this.#lastPos);
  }

  tick(pos) {
    if (this.#lastPos == null) {
      this.#lastPos = pos;
      this.#syncState(pos);
      return;
    }
    if (pos < this.#lastPos) {
      // Backwards jump while "playing" — treat as a seek.
      this.seek(pos);
      return;
    }
    for (const c of this.#cues) {
      if (c.at <= this.#lastPos) continue;
      if (c.at > pos) break;
      if (INSTANT_CUE_TYPES.includes(c.type)) this.onFire(c);
    }
    this.#lastPos = pos;
    this.#syncState(pos);
  }

  seek(pos) {
    this.#lastPos = pos;
    this.#syncState(pos);
  }

  reset() {
    this.#lastPos = null;
    for (const t of STATE_CUE_TYPES) {
      if (this.#state[t] !== null) {
        this.#state[t] = null;
        this.onState(t, null);
      }
    }
  }

  #syncState(pos) {
    for (const t of STATE_CUE_TYPES) {
      const next = stateCueAt(this.#cues, t, pos);
      if (next !== this.#state[t]) {
        this.#state[t] = next;
        this.onState(t, next);
      }
    }
  }
}
