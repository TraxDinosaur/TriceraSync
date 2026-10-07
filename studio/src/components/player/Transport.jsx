// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { Button } from "@/components/ui/Button";
import { frameMs } from "@/lib/time/format";
import { useEditor } from "@/store/editorStore";
import { TimeReadout } from "./TimeReadout";

const RATES = [0.25, 0.5, 1, 1.5, 2];
const FPS_OPTIONS = [24, 25, 30, 50, 60];

/** Play/pause, frame + second stepping, rate and fps selectors, time readout. */
export function Transport({ adapter }) {
  const playing = useEditor((s) => s.playing);
  const rate = useEditor((s) => s.rate);
  const fps = useEditor((s) => s.fps);
  const setRate = useEditor((s) => s.setRate);
  const setFps = useEditor((s) => s.setFps);
  const preview = useEditor((s) => s.preview);
  const togglePreview = useEditor((s) => s.togglePreview);
  const scrubAudio = useEditor((s) => s.scrubAudio);
  const toggleScrubAudio = useEditor((s) => s.toggleScrubAudio);
  const disabled = !adapter;

  const step = (deltaMs) => {
    if (!adapter) return;
    adapter.pause();
    adapter.seek(useEditor.getState().playheadMs + deltaMs);
  };

  return (
    <div className="border-border bg-bg-elev flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <Button
        variant="secondary"
        size="icon"
        title="Back 1 s (Shift+←)"
        disabled={disabled}
        onClick={() => step(-1000)}
      >
        ⏮
      </Button>
      <Button
        variant="secondary"
        size="icon"
        title="Back 1 frame (←)"
        disabled={disabled}
        onClick={() => step(-frameMs(fps))}
      >
        ◀
      </Button>
      <Button
        size="icon"
        title="Play / pause (Space)"
        disabled={disabled}
        onClick={() => adapter?.togglePlay()}
        aria-pressed={playing}
      >
        {playing ? "❚❚" : "▶"}
      </Button>
      <Button
        variant="secondary"
        size="icon"
        title="Forward 1 frame (→)"
        disabled={disabled}
        onClick={() => step(frameMs(fps))}
      >
        ▶
      </Button>
      <Button
        variant="secondary"
        size="icon"
        title="Forward 1 s (Shift+→)"
        disabled={disabled}
        onClick={() => step(1000)}
      >
        ⏭
      </Button>

      <div className="mx-2">
        <TimeReadout />
      </div>

      <Button
        variant={scrubAudio ? "secondary" : "ghost"}
        size="sm"
        className="ml-auto"
        onClick={toggleScrubAudio}
        aria-pressed={scrubAudio}
        title="Play a short burst of audio while stepping or dragging the playhead"
      >
        {scrubAudio ? "Scrub audio on" : "Scrub audio off"}
      </Button>
      <Button
        variant={preview ? "primary" : "secondary"}
        size="sm"
        onClick={togglePreview}
        aria-pressed={preview}
        title="Simulate cues over the video (flash, dim, vibrate badge, volume)"
      >
        {preview ? "Preview on" : "Preview"}
      </Button>
      <label className="text-fg-muted flex items-center gap-1.5 text-xs">
        Speed
        <select
          className="bg-bg border-border text-fg h-7 rounded border px-1.5 text-xs"
          value={rate}
          disabled={disabled}
          onChange={(e) => {
            const r = Number(e.target.value);
            setRate(r);
            adapter?.setRate(r);
          }}
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>
      <label className="text-fg-muted flex items-center gap-1.5 text-xs">
        FPS
        <select
          className="bg-bg border-border text-fg h-7 rounded border px-1.5 text-xs"
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        >
          {FPS_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
