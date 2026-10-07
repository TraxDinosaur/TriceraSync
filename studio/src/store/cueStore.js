// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { create } from "zustand";
import { temporal } from "zundo";
import { defaultCue } from "@/lib/pcf/defaults";
import { sortCues } from "@/lib/pcf/sort";

const UNDO_LIMIT = 100;

/**
 * Cue working set for the open project. Only `cues` participates in undo/redo (FR-11);
 * selection, zoom and view state are excluded via `partialize`.
 */
export const useCues = create(
  temporal(
    (set, get) => ({
      cues: [],
      selection: new Set(),
      dirty: false,
      sheetVersion: null,
      activeType: "vibrate",
      /** A newer localStorage draft the user may restore (FR-12); null when none. */
      pendingDraft: null,

      /** Replace the working set (initial load, restore draft, after save). */
      load(cues, { sheetVersion = null, dirty = false } = {}) {
        set({
          cues: sortCues(cues),
          selection: new Set(),
          dirty,
          sheetVersion,
          pendingDraft: null,
        });
      },
      offerDraft(pendingDraft) {
        set({ pendingDraft });
      },
      markSaved(sheetVersion) {
        set({ dirty: false, sheetVersion });
      },
      setActiveType(activeType) {
        set({ activeType });
      },

      addCue(type, at) {
        const cue = defaultCue(type, at);
        set((s) => ({
          cues: sortCues([...s.cues, cue]),
          selection: new Set([cue.id]),
          dirty: true,
        }));
        return cue;
      },
      /** Insert already-built cues (presets, paste). */
      insertCues(list) {
        set((s) => ({
          cues: sortCues([...s.cues, ...list]),
          selection: new Set(list.map((c) => c.id)),
          dirty: true,
        }));
      },
      updateCue(id, patch) {
        set((s) => ({
          cues: sortCues(s.cues.map((c) => (c.id === id ? { ...c, ...patch } : c))),
          dirty: true,
        }));
      },
      /** Replace a cue wholesale (type changes from the inspector). */
      replaceCue(id, next) {
        set((s) => ({ cues: sortCues(s.cues.map((c) => (c.id === id ? next : c))), dirty: true }));
      },
      moveCues(ids, deltaMs, durationMs) {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        set((s) => {
          const moving = s.cues.filter((c) => idSet.has(c.id));
          if (moving.length === 0) return {};
          // Clamp the delta so the group stays inside [0, duration].
          const minAt = Math.min(...moving.map((c) => c.at));
          const maxAt = Math.max(...moving.map((c) => c.at));
          let d = Math.round(deltaMs);
          if (minAt + d < 0) d = -minAt;
          if (durationMs != null && maxAt + d > durationMs) d = durationMs - maxAt;
          if (d === 0) return {};
          return {
            cues: sortCues(s.cues.map((c) => (idSet.has(c.id) ? { ...c, at: c.at + d } : c))),
            dirty: true,
          };
        });
      },
      /** Absolute time/duration updates for a drag gesture: `{ [id]: { at, durationMs? } }`. */
      applyTimes(map) {
        set((s) => ({
          cues: sortCues(
            s.cues.map((c) => {
              const t = map[c.id];
              if (!t) return c;
              const next = { ...c, at: t.at };
              if (t.durationMs !== undefined) next.durationMs = t.durationMs;
              return next;
            }),
          ),
          dirty: true,
        }));
      },
      deleteCues(ids) {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        set((s) => ({
          cues: s.cues.filter((c) => !idSet.has(c.id)),
          selection: new Set([...s.selection].filter((id) => !idSet.has(id))),
          dirty: true,
        }));
      },
      deleteSelected() {
        get().deleteCues(get().selection);
      },

      select(ids, { additive = false, toggle = false } = {}) {
        const list = Array.isArray(ids) ? ids : [ids];
        set((s) => {
          if (toggle) {
            const next = new Set(s.selection);
            for (const id of list) next.has(id) ? next.delete(id) : next.add(id);
            return { selection: next };
          }
          return { selection: additive ? new Set([...s.selection, ...list]) : new Set(list) };
        });
      },
      selectAll() {
        set((s) => ({ selection: new Set(s.cues.map((c) => c.id)) }));
      },
      clearSelection() {
        set({ selection: new Set() });
      },
    }),
    {
      limit: UNDO_LIMIT,
      partialize: (s) => ({ cues: s.cues }),
      equality: (a, b) => a.cues === b.cues,
    },
  ),
);

/** Undo/redo helpers for the toolbar and shortcuts. */
export const cueHistory = {
  undo: () => useCues.temporal.getState().undo(),
  redo: () => useCues.temporal.getState().redo(),
  clear: () => useCues.temporal.getState().clear(),
  /** Suspend history while dragging so one gesture is one undo step. */
  pause: () => useCues.temporal.getState().pause(),
  resume: () => useCues.temporal.getState().resume(),
};

/** Selected cue objects in timeline order. */
export const selectSelectedCues = (s) => s.cues.filter((c) => s.selection.has(c.id));
