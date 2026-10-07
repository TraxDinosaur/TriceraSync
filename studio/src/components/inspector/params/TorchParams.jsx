// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { CheckboxField, NumberField, SliderField } from "../fields";

const pct = (v) => `${Math.round((v ?? 0) * 100)} %`;

export function TorchParams({ params, setParams, err, group }) {
  return (
    <>
      <CheckboxField label="Torch on" checked={params.on} onChange={(on) => setParams({ on })} />
      {params.on && (
        <>
          <NumberField
            label="Auto-off after"
            value={params.durationMs ?? null}
            min={16}
            max={30000}
            suffix="ms"
            onChange={(v) => setParams({ durationMs: v ?? undefined })}
            error={err("params.durationMs")}
            group={group}
          />
          <SliderField
            label="Strength (Android 13+)"
            value={params.strength ?? 1}
            format={pct}
            onChange={(v) => setParams({ strength: v })}
            error={err("params.strength")}
            group={group}
          />
        </>
      )}
    </>
  );
}
