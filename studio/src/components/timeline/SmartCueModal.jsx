// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { computeNovelty, detectAudioCues, filterAudioBuffer, pickOnsets } from "@/lib/audio/detect";
import { CUE_LABELS, defaultCue } from "@/lib/pcf/defaults";
import { useCues } from "@/store/cueStore";
import { useWaveformStore } from "@/store/waveformStore";

const MODES = [
  { id: "subbass", label: "Sub-Bass & 808", hint: "Subwoofer, bass drops, explosions" },
  { id: "action", label: "Action & Gunfire", hint: "Gunshots, punches, sharp impacts" },
  { id: "jumpscare", label: "Jump-scare", hint: "Quiet suspense into sudden shock" },
  { id: "all", label: "Full Dynamic", hint: "All attack onsets across spectrum" },
];

const TARGET_TYPES = ["vibrate", "flash", "volume", "torch", "brightness"];
const MAX_CUES = 2000;
const FLASH_MIN_GAP_MS = 334; // Engine FlashOverlayActuator drops >3/sec (photosafety)

export function SmartCueModal({ open, onClose }) {
  const peaks = useWaveformStore((s) => s.peaks);
  const audioBuffer = useWaveformStore((s) => s.audioBuffer);
  const peaksPerSec = useWaveformStore((s) => s.peaksPerSec);
  const setPreviewMarkers = useWaveformStore((s) => s.setPreviewMarkers);

  const [mode, setMode] = useState("subbass");
  const [sensitivity, setSensitivity] = useState(65); // 10..95
  const [minGapMs, setMinGapMs] = useState(180);
  const [targetType, setTargetType] = useState("vibrate");
  const [noveltyData, setNoveltyData] = useState(null);
  const [dspBusy, setDspBusy] = useState(false);

  const effectiveMinGapMs = targetType === "flash" ? Math.max(minGapMs, FLASH_MIN_GAP_MS) : minGapMs;

  // Re-filter when mode or buffer changes
  useEffect(() => {
    if (!open || !audioBuffer) return;
    let cancelled = false;

    async function process() {
      const needsFilter = mode === "subbass" || mode === "action";
      if (needsFilter) setDspBusy(true);
      try {
        let samples;
        if (mode === "subbass") {
          samples = await filterAudioBuffer(audioBuffer, "lowpass", 140, 1.2);
        } else if (mode === "action") {
          samples = await filterAudioBuffer(audioBuffer, "bandpass", 800, 0.8);
        } else {
          samples = audioBuffer.getChannelData(0);
        }
        if (cancelled) return;
        const { novelty, rawEnergy } = computeNovelty(samples, 512, 256, 100);
        setNoveltyData({ novelty, rawEnergy, sampleRate: audioBuffer.sampleRate });
      } catch (err) {
        console.error("DSP filtering error:", err);
      } finally {
        if (!cancelled) setDspBusy(false);
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [open, audioBuffer, mode]);

  // Real-time onset picking on slider drag (<2ms)
  const detected = useMemo(() => {
    if (noveltyData) {
      return pickOnsets(noveltyData.novelty, noveltyData.rawEnergy, noveltyData.sampleRate, 256, {
        sensitivity,
        minGapMs: effectiveMinGapMs,
        mode,
        maxCues: MAX_CUES,
      });
    }
    if (peaks && peaks.length > 0) {
      const threshold = Math.max(0.1, 1.05 - sensitivity / 100);
      return detectAudioCues(peaks, peaksPerSec, {
        threshold,
        minGapMs: effectiveMinGapMs,
        mode,
        maxCues: MAX_CUES,
      });
    }
    return [];
  }, [noveltyData, peaks, peaksPerSec, sensitivity, effectiveMinGapMs, mode]);

  // Live preview markers on the waveform track while dialog is open
  useEffect(() => {
    if (open) {
      setPreviewMarkers(detected);
    } else {
      setPreviewMarkers(null);
    }
  }, [open, detected, setPreviewMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setPreviewMarkers(null);
  }, [setPreviewMarkers]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleApply = () => {
    if (detected.length === 0) {
      toast.error("No cues detected with current sensitivity");
      return;
    }
    const newCues = detected.map((at) => defaultCue(targetType, at));
    useCues.getState().insertCues(newCues);
    toast.success(`Added ${newCues.length} ${CUE_LABELS[targetType]} cue(s)`);
    setPreviewMarkers(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-cue-title"
        onKeyDown={(e) => e.stopPropagation()}
        className="bg-bg-elev border-border flex w-full max-w-md flex-col gap-4 rounded-xl border p-5 shadow-2xl"
      >
        <div className="border-border flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-accent text-base">⚡</span>
            <h2 id="smart-cue-title" className="text-fg text-sm font-semibold tracking-tight">
              Smart Cue DSP Auto-Detect
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg rounded p-1 text-xs"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode presets */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted font-medium tracking-wider uppercase">
              Frequency Profile
            </span>
            {dspBusy && (
              <span className="text-accent animate-pulse text-[10px]">DSP filtering…</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex flex-col rounded-lg border p-2 text-left transition-colors ${
                  mode === m.id
                    ? "border-accent bg-accent/10 text-fg"
                    : "border-border bg-bg-elev-2 text-fg-muted hover:text-fg"
                }`}
              >
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-fg-muted line-clamp-1 text-[10px]">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted font-medium tracking-wider uppercase">
              Attack Sensitivity
            </span>
            <span className="text-accent font-mono">{sensitivity}%</span>
          </div>
          <input
            type="range"
            min="15"
            max="95"
            step="1"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="accent-accent bg-bg-elev-2 h-2 w-full cursor-pointer rounded-lg"
          />
          <div className="text-fg-muted flex justify-between text-[10px]">
            <span>Heavy transients only</span>
            <span>Subtle beats &amp; attacks</span>
          </div>
        </div>

        {/* Cooldown and Cue Type */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-fg-muted font-medium tracking-wider uppercase">Min Spacing</span>
            <select
              value={effectiveMinGapMs}
              onChange={(e) => setMinGapMs(Number(e.target.value))}
              className="bg-bg border-border text-fg h-8 rounded-md border px-2 text-xs outline-none"
            >
              {targetType === "flash" ? (
                <>
                  <option value="334">334 ms (Max 3/s - Photosafety)</option>
                  <option value="400">400 ms</option>
                  <option value="500">500 ms</option>
                  <option value="1000">1000 ms (1 s)</option>
                </>
              ) : (
                <>
                  <option value="100">100 ms (Fast beats)</option>
                  <option value="150">150 ms</option>
                  <option value="180">180 ms (Default)</option>
                  <option value="250">250 ms</option>
                  <option value="400">400 ms (Single hits)</option>
                </>
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-fg-muted font-medium tracking-wider uppercase">Cue Type</span>
            <select
              value={targetType}
              onChange={(e) => {
                const t = e.target.value;
                setTargetType(t);
                if (t === "flash" && minGapMs < FLASH_MIN_GAP_MS) {
                  setMinGapMs(FLASH_MIN_GAP_MS);
                }
              }}
              className="bg-bg border-border text-fg h-8 rounded-md border px-2 text-xs outline-none"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CUE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {targetType === "flash" && (
          <p className="text-[10px] text-warning -mt-2">
            Photosafety: Flash rate clamped to ≤3 flashes/sec (min 334 ms gap).
          </p>
        )}

        {!audioBuffer && (!peaks || peaks.length === 0) && (
          <div className="border-warning/40 bg-warning/10 text-warning rounded-lg border p-2 text-xs">
            No local audio available. Load a local video to enable Smart Cue detection.
          </div>
        )}

        {/* Detection feedback badge */}
        <div className="border-border bg-bg/50 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <span className="text-fg-muted">
            {mode === "subbass"
              ? "DSP: 140Hz Lowpass (Sub-bass)"
              : mode === "action"
                ? "DSP: 800Hz Bandpass (Gunshots)"
                : mode === "jumpscare"
                  ? "DSP: Pre-silence attack"
                  : "DSP: Full spectrum"}
          </span>
          <span className={detected.length >= MAX_CUES ? "text-warning font-medium" : "text-accent font-medium"}>
            {detected.length} cue{detected.length === 1 ? "" : "s"} detected
            {detected.length >= MAX_CUES ? " (cap reached)" : ""}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={detected.length === 0 || dspBusy}>
            {dspBusy ? "Filtering…" : `Insert ${detected.length} Cue${detected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
