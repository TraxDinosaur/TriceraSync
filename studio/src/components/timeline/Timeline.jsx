// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CUE_COLOR_VAR, CUE_LABELS, LANE_ORDER, cueExtentMs } from "@/lib/pcf/defaults";
import {
  GUTTER_WIDTH,
  LANE_HEIGHT,
  RULER_HEIGHT,
  WAVEFORM_HEIGHT,
  clamp,
  snapMs,
  zoomBounds,
} from "@/lib/timeline/geometry";
import { cueHistory, useCues } from "@/store/cueStore";
import { useEditor } from "@/store/editorStore";
import { useTimeline } from "@/store/timelineStore";
import { Lane } from "./Lane";
import { Playhead } from "./Playhead";
import { Ruler } from "./Ruler";
import { SmartCueModal } from "./SmartCueModal";
import { WaveformTrack } from "./WaveformTrack";

const DRAG_THRESHOLD_PX = 3;
const ZOOM_STEP = 1.25;
const MIN_HOLD_MS = 16;

/**
 * Zoomable, scrollable cue timeline (PRD FR-07..FR-11). All pointer gestures are handled on
 * the viewport and dispatched by data-attributes on the target: cue markers, resize handles,
 * the ruler/playhead (scrub) and lane backgrounds (click = seek, drag = marquee, dblclick = add).
 */
export function Timeline({ adapter, invalidIds, file }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const fittedRef = useRef(false);
  const [marquee, setMarquee] = useState(null);
  const [smartCueOpen, setSmartCueOpen] = useState(false);

  const durationMs = useEditor((s) => s.durationMs);
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const scrollLeft = useTimeline((s) => s.scrollLeft);
  const viewportWidth = useTimeline((s) => s.viewportWidth);
  const waveformHeight = useTimeline((s) => s.waveformHeight ?? WAVEFORM_HEIGHT);
  const laneHeight = useTimeline((s) => s.laneHeight ?? LANE_HEIGHT);
  const snapGrid = useTimeline((s) => s.snapGrid);
  const snapCues = useTimeline((s) => s.snapCues);
  const setView = useTimeline((s) => s.set);
  const activeType = useCues((s) => s.activeType);
  const setActiveType = useCues((s) => s.setActiveType);
  const cueCount = useCues((s) => s.cues.length);

  const totalPx = Math.max((durationMs ?? 0) * pxPerMs, viewportWidth);
  const fromMs = scrollLeft / pxPerMs;
  const toMs = (scrollLeft + viewportWidth) / pxPerMs;

  // --- zoom helpers ---------------------------------------------------------------------
  const setZoom = useCallback(
    (nextPxPerMs, anchorClientX) => {
      const el = viewportRef.current;
      if (!el) return;
      const { min, max } = zoomBounds(el.clientWidth, durationMs);
      const next = clamp(nextPxPerMs, min, max);
      const prev = useTimeline.getState().pxPerMs;
      if (next === prev) return;
      const rect = el.getBoundingClientRect();
      const anchorX = anchorClientX != null ? anchorClientX - rect.left : el.clientWidth / 2;
      const anchorMs = (el.scrollLeft + anchorX) / prev;
      setView({ pxPerMs: next });
      // Keep the time under the cursor stationary.
      requestAnimationFrame(() => {
        el.scrollLeft = anchorMs * next - anchorX;
        setView({ scrollLeft: el.scrollLeft });
      });
    },
    [durationMs, setView],
  );

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !durationMs) return;
    setView({ pxPerMs: el.clientWidth / durationMs, scrollLeft: 0 });
    el.scrollLeft = 0;
  }, [durationMs, setView]);

  // --- measure + initial fit ------------------------------------------------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ viewportWidth: el.clientWidth }));
    ro.observe(el);
    setView({ viewportWidth: el.clientWidth });
    return () => ro.disconnect();
  }, [setView]);

  useEffect(() => {
    if (!fittedRef.current && durationMs && viewportWidth) {
      fittedRef.current = true;
      fit();
    }
  }, [durationMs, viewportWidth, fit]);

  // --- scroll sync + wheel (zoom with Ctrl, otherwise horizontal scroll) -------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setView({ scrollLeft: el.scrollLeft }));
    };
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        setZoom(useTimeline.getState().pxPerMs * factor, e.clientX);
      } else if (e.altKey) {
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const curW = useTimeline.getState().waveformHeight ?? WAVEFORM_HEIGHT;
        const curL = useTimeline.getState().laneHeight ?? LANE_HEIGHT;
        useTimeline.getState().set({
          waveformHeight: Math.max(28, Math.min(240, Math.round(curW * factor))),
          laneHeight: Math.max(24, Math.min(100, Math.round(curL * factor))),
        });
      } else {
        el.scrollLeft += e.deltaX || e.deltaY;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, [setView, setZoom]);

  // --- auto-follow the playhead while playing --------------------------------------------
  useEffect(() => {
    return useEditor.subscribe((s) => {
      const el = viewportRef.current;
      if (!el || !s.playing) return;
      const x = s.playheadMs * useTimeline.getState().pxPerMs;
      const w = el.clientWidth;
      if (x > el.scrollLeft + w * 0.9 || x < el.scrollLeft)
        el.scrollLeft = Math.max(0, x - w * 0.2);
    });
  }, []);

  // --- pointer gestures ----------------------------------------------------------------
  const msAt = (clientX) => {
    const el = viewportRef.current;
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left + el.scrollLeft) / useTimeline.getState().pxPerMs;
  };
  const contentPoint = (e) => {
    const el = viewportRef.current;
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top };
  };
  const seek = (ms) => {
    if (!adapter) return;
    adapter.seek(clamp(ms, 0, durationMs ?? ms));
  };
  /** Dragging the ruler / playhead plays the audio under the cursor, like a video editor. */
  const scrub = (ms) => {
    if (!adapter) return;
    adapter.scrub(clamp(ms, 0, durationMs ?? ms), useEditor.getState().scrubAudio);
  };
  const snapOpts = (excludeIds = new Set()) => {
    const { pxPerMs: p, snapGrid: g, snapCues: c, gridMs } = useTimeline.getState();
    const points = [0];
    if (durationMs) points.push(durationMs);
    points.push(useEditor.getState().playheadMs);
    if (c) {
      for (const cue of useCues.getState().cues) {
        if (excludeIds.has(cue.id)) continue;
        points.push(cue.at);
        const ext = cueExtentMs(cue);
        if (ext) points.push(cue.at + ext);
      }
    }
    return { pxPerMs: p, grid: g ? gridMs : null, points };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const el = viewportRef.current;
    const target = e.target.closest(
      "[data-handle],[data-cue-id],[data-playhead],[data-ruler],[data-waveform],[data-lane-type]",
    );
    if (!target) return;
    el.setPointerCapture(e.pointerId);
    const store = useCues.getState();
    const startMs = msAt(e.clientX);
    const { x, y } = contentPoint(e);

    if (target.dataset.handle === "resize-waveform-v") {
      dragRef.current = {
        kind: "resize-waveform-v",
        startY: e.clientY,
        startH: useTimeline.getState().waveformHeight ?? WAVEFORM_HEIGHT,
      };
      return;
    }
    if (target.dataset.handle === "resize") {
      const id = target.dataset.cueId;
      const cue = store.cues.find((c) => c.id === id);
      store.select(id);
      dragRef.current = {
        kind: "resize",
        id,
        startMs,
        origAt: cue.at,
        origDur: cue.durationMs ?? 0,
        paused: false,
      };
      return;
    }
    if (target.dataset.cueId) {
      const id = target.dataset.cueId;
      if (e.shiftKey) store.select(id, { toggle: true });
      else if (!store.selection.has(id)) store.select(id);
      const ids = [...useCues.getState().selection];
      const originals = Object.fromEntries(
        useCues
          .getState()
          .cues.filter((c) => ids.includes(c.id))
          .map((c) => [c.id, c.at]),
      );
      dragRef.current = {
        kind: "maybe-move",
        id,
        ids,
        originals,
        startX: e.clientX,
        startMs,
        shift: e.shiftKey,
        paused: false,
      };
      return;
    }
    if (
      target.dataset.playhead != null ||
      target.dataset.ruler != null ||
      target.dataset.waveform != null
    ) {
      adapter?.pause();
      scrub(startMs);
      dragRef.current = { kind: "scrub" };
      return;
    }
    if (target.dataset.laneType) {
      dragRef.current = {
        kind: "maybe-marquee",
        startX: x,
        startY: y,
        startMs,
        laneType: target.dataset.laneType,
        shift: e.shiftKey,
      };
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const store = useCues.getState();

    if (d.kind === "resize-waveform-v") {
      const delta = e.clientY - d.startY;
      const nextH = Math.max(28, Math.min(240, Math.round(d.startH + delta)));
      useTimeline.getState().set({ waveformHeight: nextH });
      return;
    }
    if (d.kind === "maybe-move") {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
      d.kind = "move";
    }
    if (d.kind === "move") {
      const delta = msAt(e.clientX) - d.startMs;
      const primaryAt = d.originals[d.id];
      const snapped = snapMs(primaryAt + delta, snapOpts(new Set(d.ids)));
      let actual = Math.round(snapped - primaryAt);
      const ats = d.ids.map((id) => d.originals[id]);
      const minAt = Math.min(...ats);
      const maxAt = Math.max(...ats);
      if (minAt + actual < 0) actual = -minAt;
      if (durationMs && maxAt + actual > durationMs) actual = durationMs - maxAt;
      store.applyTimes(
        Object.fromEntries(d.ids.map((id) => [id, { at: d.originals[id] + actual }])),
      );
      if (!d.paused) {
        d.paused = true;
        cueHistory.pause(); // first update recorded the pre-drag state; the rest is one gesture
      }
      return;
    }
    if (d.kind === "resize") {
      const delta = msAt(e.clientX) - d.startMs;
      const end = snapMs(d.origAt + d.origDur + delta, snapOpts(new Set([d.id])));
      let dur = Math.round(end - d.origAt);
      dur = Math.max(MIN_HOLD_MS, dur);
      if (durationMs) dur = Math.min(dur, durationMs - d.origAt);
      store.applyTimes({ [d.id]: { at: d.origAt, durationMs: dur } });
      if (!d.paused) {
        d.paused = true;
        cueHistory.pause();
      }
      return;
    }
    if (d.kind === "scrub") {
      scrub(msAt(e.clientX));
      return;
    }
    if (d.kind === "maybe-marquee") {
      const { x } = contentPoint(e);
      if (Math.abs(x - d.startX) < DRAG_THRESHOLD_PX) return;
      d.kind = "marquee";
    }
    if (d.kind === "marquee") {
      const { x, y } = contentPoint(e);
      const rect = {
        x1: Math.min(d.startX, x),
        x2: Math.max(d.startX, x),
        y1: Math.min(d.startY, y),
        y2: Math.max(d.startY, y),
      };
      setMarquee(rect);
      const p = useTimeline.getState().pxPerMs;
      const hit = store.cues
        .filter((c) => {
          const laneIdx = LANE_ORDER.indexOf(c.type);
          const top = RULER_HEIGHT + waveformHeight + laneIdx * laneHeight;
          const bottom = top + laneHeight;
          const cx = c.at * p;
          return cx >= rect.x1 && cx <= rect.x2 && bottom >= rect.y1 && top <= rect.y2;
        })
        .map((c) => c.id);
      store.select(hit, { additive: d.shift });
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    viewportRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    const store = useCues.getState();
    if (d.kind === "maybe-move" && !d.shift && store.selection.size > 1) store.select(d.id);
    if ((d.kind === "move" || d.kind === "resize") && d.paused) cueHistory.resume();
    if (d.kind === "maybe-marquee") {
      seek(d.startMs);
      if (!d.shift) store.clearSelection();
      setActiveType(d.laneType);
    }
    if (d.kind === "marquee") setMarquee(null);
  };

  const onDoubleClick = (e) => {
    const lane = e.target.closest("[data-lane-type]");
    if (!lane || e.target.closest("[data-cue-id]")) return;
    const type = lane.dataset.laneType;
    const ms = snapMs(msAt(e.clientX), snapOpts());
    setActiveType(type);
    useCues.getState().addCue(type, clamp(ms, 0, durationMs ?? ms));
  };

  const addAtPlayhead = (type) => {
    setActiveType(type);
    useCues.getState().addCue(type, useEditor.getState().playheadMs);
  };

  return (
    <div className="border-border bg-bg-elev flex flex-col overflow-hidden rounded-lg border">
      <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addAtPlayhead(activeType)}
          title="Add cue at playhead (M)"
        >
          + {CUE_LABELS[activeType]}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSmartCueOpen(true)}
          title="Auto-detect peaks and transient hits from audio"
          className="text-accent hover:text-accent border-accent/20 border"
        >
          ⚡ Smart Cue
        </Button>
        <span className="bg-border mx-1 h-4 w-px" />
        <Button variant="ghost" size="sm" onClick={cueHistory.undo} title="Undo (Ctrl+Z)">
          Undo
        </Button>
        <Button variant="ghost" size="sm" onClick={cueHistory.redo} title="Redo (Ctrl+Y)">
          Redo
        </Button>
        <span className="bg-border mx-1 h-4 w-px" />
        <Toggle on={snapGrid} onClick={useTimeline.getState().toggleSnapGrid} label="Grid 10 ms" />
        <Toggle on={snapCues} onClick={useTimeline.getState().toggleSnapCues} label="Snap cues" />
        <span className="text-fg-muted ml-auto text-xs">{cueCount} cues</span>
        <span className="bg-border mx-1 h-4 w-px" />
        <span className="text-fg-muted font-mono text-[10px]">H:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(pxPerMs / ZOOM_STEP)}
          title="Zoom out (Ctrl+wheel)"
        >
          −
        </Button>
        <Button variant="ghost" size="sm" onClick={fit} title="Fit whole video">
          Fit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(pxPerMs * ZOOM_STEP)}
          title="Zoom in (Ctrl+wheel)"
        >
          +
        </Button>
        <span className="bg-border mx-1 h-4 w-px" />
        <span className="text-fg-muted font-mono text-[10px]">V:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const s = useTimeline.getState();
            s.set({
              waveformHeight: Math.max(
                28,
                Math.round((s.waveformHeight ?? WAVEFORM_HEIGHT) / 1.25),
              ),
              laneHeight: Math.max(24, Math.round((s.laneHeight ?? LANE_HEIGHT) / 1.25)),
            });
          }}
          title="Vertical shrink (Alt+wheel)"
        >
          −
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            useTimeline
              .getState()
              .set({ waveformHeight: WAVEFORM_HEIGHT, laneHeight: LANE_HEIGHT });
          }}
          title="Reset vertical track height"
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const s = useTimeline.getState();
            s.set({
              waveformHeight: Math.min(
                240,
                Math.round((s.waveformHeight ?? WAVEFORM_HEIGHT) * 1.25),
              ),
              laneHeight: Math.min(100, Math.round((s.laneHeight ?? LANE_HEIGHT) * 1.25)),
            });
          }}
          title="Vertical expand (Alt+wheel)"
        >
          +
        </Button>
      </div>

      <div className="flex">
        <div className="border-border shrink-0 border-r" style={{ width: GUTTER_WIDTH }}>
          <div className="border-border bg-bg-elev-2 border-b" style={{ height: RULER_HEIGHT }} />
          <div
            className="border-border relative flex w-full items-center gap-2 border-b px-2 text-left text-xs text-fg-muted select-none"
            style={{ height: waveformHeight }}
            title="Audio waveform track"
          >
            <span className="size-2 rounded-full bg-cue-volume" />
            Audio
            <div
              data-handle="resize-waveform-v"
              onPointerDown={(e) => {
                e.stopPropagation();
                const handle = e.currentTarget;
                handle.setPointerCapture(e.pointerId);
                const startY = e.clientY;
                const startH = useTimeline.getState().waveformHeight ?? WAVEFORM_HEIGHT;
                const onMove = (ev) => {
                  const delta = ev.clientY - startY;
                  const nextH = Math.max(28, Math.min(240, Math.round(startH + delta)));
                  useTimeline.getState().set({ waveformHeight: nextH });
                };
                const onUp = (ev) => {
                  try {
                    handle.releasePointerCapture(ev.pointerId);
                  } catch {}
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
              className="group absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize"
              title="Drag to resize waveform vertically"
            >
              <div className="group-hover:bg-accent/70 h-0.5 w-full transition-colors" />
            </div>
          </div>
          {LANE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              onDoubleClick={() => addAtPlayhead(type)}
              className={`border-border flex w-full items-center gap-2 border-b px-2 text-left text-xs ${
                activeType === type ? "bg-accent/10 text-fg" : "text-fg-muted hover:text-fg"
              }`}
              style={{ height: laneHeight }}
              title="Click to make active · double-click to add at playhead"
            >
              <span className="size-2 rounded-full" style={{ background: CUE_COLOR_VAR[type] }} />
              {CUE_LABELS[type]}
            </button>
          ))}
        </div>

        <div
          ref={viewportRef}
          className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
          style={{ height: RULER_HEIGHT + waveformHeight + LANE_ORDER.length * laneHeight + 12 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <div className="relative" style={{ width: totalPx }}>
            <Ruler fromMs={fromMs} toMs={toMs} />
            <WaveformTrack
              file={file}
              fromMs={fromMs}
              toMs={toMs}
              pxPerMs={pxPerMs}
              viewportWidth={viewportWidth}
              height={waveformHeight}
            />
            {LANE_ORDER.map((type) => (
              <Lane
                key={type}
                type={type}
                fromMs={fromMs}
                toMs={toMs}
                invalidIds={invalidIds}
                height={laneHeight}
              />
            ))}
            <Playhead />
            {marquee && (
              <div
                className="border-accent bg-accent/10 pointer-events-none absolute z-40 border"
                style={{
                  left: marquee.x1,
                  top: marquee.y1,
                  width: marquee.x2 - marquee.x1,
                  height: marquee.y2 - marquee.y1,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <SmartCueModal open={smartCueOpen} onClose={() => setSmartCueOpen(false)} />
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-md px-2 py-1 text-xs transition-colors ${
        on ? "bg-accent/15 text-accent" : "text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
