// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { NumberField, SliderField } from "../fields";

const pct = (v) => `${Math.round((v ?? 0) * 100)} %`;

/** Shared editor for `brightness` and `volume`: level 0–1 + ramp. */
export function LevelParams({ params, setParams, err, group }) {
  return (
    <>
      <SliderField
        label="Level"
        value={params.level}
        format={pct}
        onChange={(v) => setParams({ level: v })}
        error={err("params.level")}
        group={group}
      />
      <NumberField
        label="Ramp"
        value={params.rampMs ?? 0}
        min={0}
        suffix="ms"
        onChange={(v) => setParams({ rampMs: v ?? 0 })}
        error={err("params.rampMs")}
        group={group}
      />
    </>
  );
}
