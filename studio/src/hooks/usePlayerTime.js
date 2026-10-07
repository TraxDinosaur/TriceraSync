// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { useEffect } from "react";
import { useEditor } from "@/store/editorStore";

/** Pipes a PlayerAdapter's events into the editor store (FR-05/06). */
export function usePlayerTime(adapter) {
  useEffect(() => {
    if (!adapter) return;
    const { setPlayhead, setPlaying, setDuration, reset } = useEditor.getState();
    const offs = [
      adapter.on("time", setPlayhead),
      adapter.on("play", () => setPlaying(true)),
      adapter.on("pause", () => setPlaying(false)),
      adapter.on("ended", () => setPlaying(false)),
      adapter.on("duration", setDuration),
      adapter.on("ready", ({ durationMs }) => setDuration(durationMs)),
    ];
    return () => {
      offs.forEach((off) => off());
      reset();
    };
  }, [adapter]);
}
