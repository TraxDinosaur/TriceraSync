// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { useEffect, useRef } from "react";
import { frameMs } from "@/lib/time/format";
import { useEditor } from "@/store/editorStore";

/** Stepping keeps its own target so a scrub burst's playback drift does not accumulate. */
const STEP_TARGET_IDLE_MS = 500;

const isTyping = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

const isModalOpen = () =>
  typeof document !== "undefined" && Boolean(document.querySelector('[role="dialog"]'));

/**
 * Transport shortcuts (PRD §6.1): Space play/pause, ←/→ frame step, Shift+←/→ 1 s,
 * Home/End. Additional keys (M, Delete, [, ] — Phase 4) are passed via `extra`.
 * @param {import("@/lib/player/PlayerAdapter").PlayerAdapter | null} adapter
 * @param {Record<string, (e: KeyboardEvent) => void>} extra
 */
export function useKeyboardShortcuts(adapter, extra = {}) {
  const stepTarget = useRef(null);
  const stepTimer = useRef(0);

  useEffect(() => {
    if (!adapter) return;

    const step = (deltaMs) => {
      const { playheadMs, durationMs, scrubAudio } = useEditor.getState();
      const from = stepTarget.current ?? playheadMs;
      const next = Math.max(0, Math.min(from + deltaMs, durationMs ?? from + deltaMs));
      stepTarget.current = next;
      clearTimeout(stepTimer.current);
      stepTimer.current = setTimeout(() => {
        stepTarget.current = null;
      }, STEP_TARGET_IDLE_MS);
      adapter.scrub(next, scrubAudio);
    };

    const onKey = (e) => {
      if (isTyping(e.target) || isModalOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
      const { fps, durationMs } = useEditor.getState();
      const stepMs = e.shiftKey ? 1000 : frameMs(fps);
      switch (e.key) {
        case " ":
          e.preventDefault();
          adapter.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          step(-stepMs);
          break;
        case "ArrowRight":
          e.preventDefault();
          step(stepMs);
          break;
        case "Home":
          e.preventDefault();
          adapter.seek(0);
          break;
        case "End":
          e.preventDefault();
          if (durationMs) adapter.seek(durationMs);
          break;
        default:
          extra[e.key]?.(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(stepTimer.current);
    };
  }, [adapter, extra]);
}
