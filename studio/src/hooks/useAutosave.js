// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { useEffect } from "react";
import { useCues } from "@/store/cueStore";

const KEY = (projectId) => `tricerasync:draft:${projectId}`;
const DEBOUNCE_MS = 300;

/** Reads a local draft `{ cues, savedAt, sheetVersion }` or null (FR-12). */
export function readDraft(projectId) {
  try {
    const raw = localStorage.getItem(KEY(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(projectId) {
  try {
    localStorage.removeItem(KEY(projectId));
  } catch {
    // storage unavailable — nothing to clear
  }
}

/** Debounced localStorage autosave of the cue working set while it is dirty. */
export function useAutosave(projectId) {
  useEffect(() => {
    let timer = 0;
    const unsub = useCues.subscribe((s, prev) => {
      if (s.cues === prev.cues || !s.dirty) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            KEY(projectId),
            JSON.stringify({ cues: s.cues, savedAt: Date.now(), sheetVersion: s.sheetVersion }),
          );
        } catch {
          // quota / private mode — autosave is best-effort
        }
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [projectId]);
}
