// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Multi-cue presets inserted relative to the playhead (PRD FR-15).
import { newCueId } from "../pcf/ids.js";
import dimIn from "./dim-in.json";
import explosion from "./explosion.json";
import heartbeat from "./heartbeat.json";
import quietMoment from "./quiet-moment.json";
import torchBlink from "./torch-blink.json";

export const PRESETS = [explosion, heartbeat, dimIn, torchBlink, quietMoment];

/** Materializes a preset at `atMs` into PCF cues with fresh ids. */
export function instantiatePreset(preset, atMs) {
  return preset.cues.map(({ offsetMs, ...cue }) => ({
    id: newCueId(),
    at: Math.max(0, Math.round(atMs + offsetMs)),
    ...cue,
  }));
}
