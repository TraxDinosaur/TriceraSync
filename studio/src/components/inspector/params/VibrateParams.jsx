// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { PREDEFINED_EFFECTS } from "@/lib/pcf/schema";
import { IntListField, NumberField, SelectField, SliderField } from "../fields";

const MODES = [
  { value: "oneShot", label: "One shot" },
  { value: "waveform", label: "Waveform" },
  { value: "predefined", label: "Predefined" },
];

const MODE_DEFAULTS = {
  oneShot: { mode: "oneShot", durationMs: 200, amplitude: 255 },
  waveform: {
    mode: "waveform",
    timings: [0, 100, 50, 300],
    amplitudes: [0, 255, 0, 180],
    repeat: -1,
  },
  predefined: { mode: "predefined", effect: "HEAVY_CLICK" },
};

export function VibrateParams({ params, setParams, replaceParams, err, group }) {
  return (
    <>
      <SelectField
        label="Mode"
        value={params.mode}
        options={MODES}
        onChange={(mode) => replaceParams(MODE_DEFAULTS[mode])}
        error={err("params.mode")}
      />
      {params.mode === "oneShot" && (
        <>
          <NumberField
            label="Duration"
            value={params.durationMs}
            min={10}
            max={10000}
            suffix="ms"
            onChange={(v) => setParams({ durationMs: v })}
            error={err("params.durationMs")}
            group={group}
          />
          <SliderField
            label="Amplitude"
            value={params.amplitude ?? 255}
            min={1}
            max={255}
            step={1}
            onChange={(v) => setParams({ amplitude: v })}
            error={err("params.amplitude")}
            group={group}
          />
        </>
      )}
      {params.mode === "waveform" && (
        <>
          <IntListField
            label="Timings (ms)"
            value={params.timings}
            onChange={(v) => setParams({ timings: v })}
            error={err("params.timings")}
            group={group}
          />
          <IntListField
            label="Amplitudes (0–255)"
            value={params.amplitudes}
            onChange={(v) => setParams({ amplitudes: v })}
            error={err("params.amplitudes")}
            group={group}
          />
          <NumberField
            label="Repeat index (−1 = none)"
            value={params.repeat ?? -1}
            min={-1}
            onChange={(v) => setParams({ repeat: v })}
            error={err("params.repeat")}
            group={group}
          />
        </>
      )}
      {params.mode === "predefined" && (
        <SelectField
          label="Effect"
          value={params.effect}
          options={PREDEFINED_EFFECTS.map((e) => ({ value: e, label: e.replace("_", " ") }))}
          onChange={(effect) => setParams({ effect })}
          error={err("params.effect")}
        />
      )}
    </>
  );
}
