// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { PRESETS, instantiatePreset } from "@/lib/presets";
import { useCues } from "@/store/cueStore";
import { useEditor } from "@/store/editorStore";

/** Inserts a multi-cue preset at the playhead (FR-15). */
export function PresetPicker() {
  const insert = (preset) => {
    const at = useEditor.getState().playheadMs;
    useCues.getState().insertCues(instantiatePreset(preset, at));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-fg-muted text-[11px] font-medium tracking-wide uppercase">
        Presets · insert at playhead
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => insert(p)}
            title={p.description}
            className="border-border bg-bg hover:border-fg-muted rounded-md border px-2 py-1.5 text-left text-xs transition-colors"
          >
            <div className="text-fg font-medium">{p.name}</div>
            <div className="text-fg-muted truncate text-[11px]">{p.cues.length} cues</div>
          </button>
        ))}
      </div>
    </div>
  );
}
