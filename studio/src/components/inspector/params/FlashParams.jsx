// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { ColorField, NumberField, SliderField } from "../fields";

const pct = (v) => `${Math.round((v ?? 0) * 100)} %`;

export function FlashParams({ params, setParams, err, group }) {
  return (
    <>
      <ColorField
        label="Color"
        value={params.color}
        onChange={(color) => setParams({ color })}
        error={err("params.color")}
      />
      <SliderField
        label="Opacity"
        value={params.opacity ?? 0.6}
        format={pct}
        onChange={(v) => setParams({ opacity: v })}
        error={err("params.opacity")}
        group={group}
      />
      <NumberField
        label="Hold"
        value={params.durationMs}
        min={16}
        max={5000}
        suffix="ms"
        onChange={(v) => setParams({ durationMs: v })}
        error={err("params.durationMs")}
        group={group}
      />
      <NumberField
        label="Fade out"
        value={params.fadeOutMs ?? 0}
        min={0}
        suffix="ms"
        onChange={(v) => setParams({ fadeOutMs: v ?? 0 })}
        error={err("params.fadeOutMs")}
        group={group}
      />
    </>
  );
}
