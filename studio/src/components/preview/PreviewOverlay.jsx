// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useEffect, useRef, useState } from "react";
import { CueRunner } from "@/lib/preview/runner";
import { useCues } from "@/store/cueStore";
import { useEditor } from "@/store/editorStore";

const FLASH_MAX_PER_SEC = 3;
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Simulates cues over the video stage while preview mode is on (PRD §6.1 step 4):
 * flash → colored overlay with fade-out, brightness → dark overlay, volume → adapter volume,
 * vibrate → badge (+ navigator.vibrate where supported), torch → badge. Mirrors Engine rules.
 */
export function PreviewOverlay({ adapter }) {
  const enabled = useEditor((s) => s.preview);
  const [flash, setFlash] = useState(null); // { id, color, opacity, durationMs, fadeOutMs }
  const [brightness, setBrightness] = useState(null); // active brightness cue
  const [vibrate, setVibrate] = useState(null); // { id, extentMs }
  const [torch, setTorch] = useState(false);
  const runnerRef = useRef(null);
  const flashTimesRef = useRef([]);

  useEffect(() => {
    if (!enabled) return;
    const timers = [];
    const runner = new CueRunner({
      onFire: (cue) => {
        if (cue.type === "flash") {
          // Photosensitivity guard: never render more than 3 flashes per second.
          const now = performance.now();
          flashTimesRef.current = flashTimesRef.current.filter((t) => now - t < 1000);
          if (flashTimesRef.current.length >= FLASH_MAX_PER_SEC || reducedMotion()) return;
          flashTimesRef.current.push(now);
          setFlash({ id: cue.id + now, ...cue.params });
          timers.push(
            setTimeout(
              () => setFlash(null),
              cue.params.durationMs + (cue.params.fadeOutMs ?? 0) + 30,
            ),
          );
        } else if (cue.type === "vibrate") {
          const p = cue.params;
          const pattern =
            p.mode === "oneShot" ? [p.durationMs] : p.mode === "waveform" ? p.timings : [40];
          try {
            navigator.vibrate?.(pattern);
          } catch {
            // unsupported — the badge still shows
          }
          const extent = pattern.reduce((a, b) => a + b, 0) || 60;
          setVibrate({ id: cue.id + performance.now(), extentMs: extent });
          timers.push(setTimeout(() => setVibrate(null), Math.max(extent, 250)));
        }
      },
      onState: (type, cue) => {
        if (type === "brightness") setBrightness(cue);
        else if (type === "volume") adapter?.setVolume(cue ? cue.params.level : 1);
        else if (type === "torch") {
          setTorch(!!cue?.params.on);
          if (cue?.params.on && cue.params.durationMs) {
            timers.push(setTimeout(() => setTorch(false), cue.params.durationMs));
          }
        }
      },
    });
    runnerRef.current = runner;
    runner.setCues(useCues.getState().cues);

    const offCues = useCues.subscribe((s, prev) => {
      if (s.cues !== prev.cues) runner.setCues(s.cues);
    });
    // Drive the runner from playhead updates without re-rendering on every frame.
    const offTime = useEditor.subscribe((s, prev) => {
      if (s.playheadMs === prev.playheadMs) return;
      if (s.playing) runner.tick(s.playheadMs);
      else runner.seek(s.playheadMs);
    });
    const offSeek = adapter?.on("seeked", (ms) => runner.seek(ms)) ?? (() => {});
    runner.seek(useEditor.getState().playheadMs);

    return () => {
      offCues();
      offTime();
      offSeek();
      timers.forEach(clearTimeout);
      runner.reset();
      runnerRef.current = null;
      adapter?.setVolume(1);
      setFlash(null);
      setBrightness(null);
      setVibrate(null);
      setTorch(false);
    };
  }, [enabled, adapter]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      {brightness && (
        <div
          className="absolute inset-0 bg-black"
          style={{
            opacity: 1 - brightness.params.level,
            transition: reducedMotion()
              ? "none"
              : `opacity ${brightness.params.rampMs ?? 0}ms linear`,
          }}
        />
      )}
      {flash && <FlashLayer key={flash.id} flash={flash} />}
      <div className="absolute top-2 left-2 flex gap-1.5">
        <span className="bg-accent/80 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
          Preview
        </span>
        {vibrate && (
          <span
            key={vibrate.id}
            className="bg-cue-vibrate animate-pulse rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-black uppercase"
          >
            Vibrate {vibrate.extentMs} ms
          </span>
        )}
        {torch && (
          <span className="bg-cue-torch rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-black uppercase">
            Torch
          </span>
        )}
      </div>
      {torch && (
        <div
          className="absolute inset-0 bg-white/20"
          style={{ boxShadow: "inset 0 0 80px 20px rgba(255,255,255,0.5)" }}
        />
      )}
    </div>
  );
}

/** Solid hold then CSS fade-out, driven by a single mount. */
function FlashLayer({ flash }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFading(true), flash.durationMs);
    return () => clearTimeout(t);
  }, [flash.durationMs]);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: flash.color,
        opacity: fading ? 0 : (flash.opacity ?? 0.6),
        transition: fading ? `opacity ${flash.fadeOutMs ?? 0}ms linear` : "none",
      }}
    />
  );
}
