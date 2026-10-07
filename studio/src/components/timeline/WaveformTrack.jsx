// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useEffect, useRef } from "react";
import { WAVEFORM_HEIGHT } from "@/lib/timeline/geometry";
import { useWaveformStore } from "@/store/waveformStore";

/**
 * Renders audio waveform as a virtualized canvas over the visible viewport.
 * Pointer-down is captured by Timeline for scrubbing (PRD FR-06/FR-07).
 */
export function WaveformTrack({ file, fromMs, toMs, pxPerMs, viewportWidth, height }) {
  const canvasRef = useRef(null);
  const status = useWaveformStore((s) => s.status);
  const error = useWaveformStore((s) => s.error);
  const peaks = useWaveformStore((s) => s.peaks);
  const peaksPerSec = useWaveformStore((s) => s.peaksPerSec);
  const previewMarkers = useWaveformStore((s) => s.previewMarkers);
  const loadFromFile = useWaveformStore((s) => s.loadFromFile);
  const h = height ?? WAVEFORM_HEIGHT;

  useEffect(() => {
    loadFromFile(file);
  }, [file, loadFromFile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || status !== "ready" || !peaks || viewportWidth <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(viewportWidth);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const centerY = h / 2;
    const halfH = Math.max(2, centerY - 2);

    // Center guide line
    ctx.strokeStyle = "rgba(43, 39, 48, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    // Waveform bars
    ctx.fillStyle = "rgba(96, 165, 250, 0.75)";
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const ms1 = fromMs + x / pxPerMs;
      const ms2 = fromMs + (x + 1) / pxPerMs;
      const idx1 = Math.max(0, Math.floor((ms1 / 1000) * peaksPerSec));
      const idx2 = Math.min(peaks.length - 1, Math.floor((ms2 / 1000) * peaksPerSec));

      let maxVal = 0;
      for (let k = idx1; k <= idx2; k++) {
        if (peaks[k] > maxVal) maxVal = peaks[k];
      }

      if (maxVal > 0) {
        const barH = Math.max(1, maxVal * halfH);
        ctx.rect(x, centerY - barH, 1, barH * 2);
      }
    }
    ctx.fill();

    // Draw Smart Cue preview detection lines
    if (previewMarkers && previewMarkers.length > 0) {
      ctx.strokeStyle = "rgba(255, 106, 42, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const atMs of previewMarkers) {
        if (atMs < fromMs || atMs > toMs) continue;
        const mx = Math.floor((atMs - fromMs) * pxPerMs);
        ctx.moveTo(mx + 0.5, 0);
        ctx.lineTo(mx + 0.5, h);
      }
      ctx.stroke();
    }
  }, [status, peaks, peaksPerSec, previewMarkers, fromMs, toMs, pxPerMs, viewportWidth, h]);

  return (
    <div
      data-waveform
      className="border-border bg-bg-elev/40 relative cursor-ew-resize border-b select-none"
      style={{ height: h }}
    >
      <div
        className="sticky left-0 flex h-full items-center justify-center overflow-hidden"
        style={{ width: viewportWidth }}
      >
        {status === "decoding" && (
          <span className="text-fg-muted animate-pulse text-xs">Decoding audio waveform…</span>
        )}
        {status === "error" && (
          <span className="text-danger/80 text-xs">{error || "Could not decode audio"}</span>
        )}
        {status === "idle" && (
          <span className="text-fg-muted/60 text-xs">Audio waveform available for local video</span>
        )}
        <canvas
          ref={canvasRef}
          className={`h-full w-full ${status === "ready" ? "block" : "hidden"}`}
          style={{ width: viewportWidth, height: h }}
        />
      </div>
      {/* Bottom vertical resize handle */}
      <div
        data-handle="resize-waveform-v"
        className="group absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize"
        title="Drag to resize waveform vertically"
      >
        <div className="group-hover:bg-accent/70 h-0.5 w-full transition-colors" />
      </div>
    </div>
  );
}
