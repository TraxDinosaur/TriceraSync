// Editor-side helpers around the PCF cue types: display metadata and sensible starting params.
import { CUE_TYPES, STATE_CUE_TYPES } from "./schema.js";
import { newCueId } from "./ids.js";

export const CUE_LABELS = {
  vibrate: "Vibrate",
  brightness: "Brightness",
  volume: "Volume",
  flash: "Flash",
  torch: "Torch",
};

/** Tailwind color token per type — matches the `--cue-*` variables in globals.css. */
export const CUE_COLOR_CLASS = {
  vibrate: "bg-cue-vibrate",
  brightness: "bg-cue-brightness",
  volume: "bg-cue-volume",
  flash: "bg-cue-flash",
  torch: "bg-cue-torch",
};

export const CUE_COLOR_VAR = {
  vibrate: "var(--cue-vibrate)",
  brightness: "var(--cue-brightness)",
  volume: "var(--cue-volume)",
  flash: "var(--cue-flash)",
  torch: "var(--cue-torch)",
};

export const LANE_ORDER = CUE_TYPES;

/** A valid cue of `type` placed at `at` with starting params the creator can tweak. */
export function defaultCue(type, at) {
  const base = { id: newCueId(), at: Math.max(0, Math.round(at)), type };
  switch (type) {
    case "vibrate":
      return { ...base, params: { mode: "oneShot", durationMs: 200, amplitude: 255 } };
    case "brightness":
      return { ...base, durationMs: 2000, params: { level: 0.2, rampMs: 200 } };
    case "volume":
      return { ...base, params: { level: 0.5, rampMs: 200 } };
    case "flash":
      return {
        ...base,
        params: { color: "#FF0000", opacity: 0.6, durationMs: 150, fadeOutMs: 150 },
      };
    case "torch":
      return { ...base, params: { on: true, durationMs: 150, strength: 1 } };
    default:
      throw new Error(`unknown cue type ${type}`);
  }
}

export const isStateCue = (cue) => STATE_CUE_TYPES.includes(cue.type);

/**
 * Visual extent of a cue on the timeline in ms. Cue-level `durationMs` (hold-then-restore)
 * is editable by resizing; instant cues show their effect length for context only.
 */
export function cueExtentMs(cue) {
  if (cue.durationMs != null) return cue.durationMs;
  const p = cue.params ?? {};
  if (cue.type === "vibrate" && p.mode === "oneShot") return p.durationMs ?? 0;
  if (cue.type === "vibrate" && p.mode === "waveform") {
    return (p.timings ?? []).reduce((a, b) => a + b, 0);
  }
  if (cue.type === "flash") return (p.durationMs ?? 0) + (p.fadeOutMs ?? 0);
  if (cue.type === "torch" && p.on) return p.durationMs ?? 0;
  return 0;
}

/** Whether the right edge of the marker can be dragged to change cue-level `durationMs`. */
export const isResizable = (cue) => isStateCue(cue);
