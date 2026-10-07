// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CueInspector } from "@/components/inspector/CueInspector";
import { Transport } from "@/components/player/Transport";
import { VideoStage } from "@/components/player/VideoStage";
import { PreviewOverlay } from "@/components/preview/PreviewOverlay";
import { Timeline } from "@/components/timeline/Timeline";
import { Button } from "@/components/ui/Button";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { toast } from "@/components/ui/Toast";
import { clearDraft, readDraft, useAutosave } from "@/hooks/useAutosave";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayerTime } from "@/hooks/usePlayerTime";
import { api } from "@/lib/api/client";
import { validateCues } from "@/lib/pcf/validate";
import { formatShort } from "@/lib/time/format";
import { cueHistory, useCues } from "@/store/cueStore";
import { useEditor } from "@/store/editorStore";
import { probeVideoDuration, useProjectFiles } from "@/store/projectFilesStore";

/**
 * Editor workspace: stage + transport + timeline (+ inspector in Phase 5).
 * `video` is the serialized `videos` row; `initialSheet` the latest cue sheet or null.
 */
export function EditorWorkspace({ video, initialSheet }) {
  const fileEntry = useProjectFiles((s) => s.files[video.id]);
  const setFile = useProjectFiles((s) => s.setFile);
  const [adapter, setAdapter] = useState(null);
  const [durationMs, setDurationMs] = useState(video.durationMs);
  const [fileError, setFileError] = useState(null);
  const [saveState, setSaveState] = useState({ busy: false, error: null });

  const cues = useCues((s) => s.cues);
  const draft = useCues((s) => s.pendingDraft);
  const dirty = useCues((s) => s.dirty);
  const sheetVersion = useCues((s) => s.sheetVersion);

  // Load the server sheet once, then offer a newer local draft if one exists.
  useEffect(() => {
    useCues
      .getState()
      .load(initialSheet?.cues ?? [], { sheetVersion: initialSheet?.sheetVersion ?? null });
    cueHistory.clear();
    const d = readDraft(video.id);
    const serverAt = initialSheet ? new Date(initialSheet.createdAt).getTime() : 0;
    if (
      d &&
      d.savedAt > serverAt &&
      JSON.stringify(d.cues) !== JSON.stringify(initialSheet?.cues ?? [])
    ) {
      useCues.getState().offerDraft(d);
    }
  }, [video.id, initialSheet]);
  useAutosave(video.id);

  const source = useMemo(() => {
    if (video.source === "youtube" && video.youtubeVideoId) {
      return { type: "youtube", videoId: video.youtubeVideoId };
    }
    if (fileEntry) return { type: "local", url: fileEntry.url };
    return null;
  }, [video.source, video.youtubeVideoId, fileEntry]);

  const onAdapter = useCallback((a) => setAdapter(a), []);
  usePlayerTime(adapter);

  // Persist the duration once the player reports it (YouTube sources are created without one).
  useEffect(() => {
    if (!adapter) return;
    return adapter.on("ready", async ({ durationMs: d }) => {
      if (!d || d === durationMs) return;
      if (durationMs && Math.abs(d - durationMs) <= 1500) return;
      try {
        await api.patch(`/api/videos/${video.id}`, { durationMs: d });
        setDurationMs(d);
      } catch {
        // non-fatal; the publish page re-checks duration
      }
    });
  }, [adapter, durationMs, video.id]);

  // Duration known before the player (local projects) → seed the store so the timeline can fit.
  useEffect(() => {
    if (durationMs && useEditor.getState().durationMs == null)
      useEditor.getState().setDuration(durationMs);
  }, [durationMs, adapter]);

  const validation = useMemo(() => validateCues(cues), [cues]);
  const invalidIds = useMemo(
    () => new Set(validation.errors.map((e) => e.cueId).filter(Boolean)),
    [validation],
  );

  const save = useCallback(async () => {
    if (!validation.ok) {
      setSaveState({
        busy: false,
        error: `${validation.errors.length} cue error(s) — fix them before saving.`,
      });
      return;
    }
    setSaveState({ busy: true, error: null });
    try {
      const sheet = await api.put(`/api/videos/${video.id}/cues`, {
        cues: useCues.getState().cues,
        meta: { fps: useEditor.getState().fps },
      });
      useCues.getState().markSaved(sheet.sheetVersion);
      clearDraft(video.id);
      setSaveState({ busy: false, error: null });
      toast.success(`Saved v${sheet.sheetVersion}`);
    } catch (err) {
      setSaveState({ busy: false, error: err.message });
      toast.error(`Save failed: ${err.message}`);
    }
  }, [validation, video.id]);

  // Cue-level shortcuts (M, Delete, [, ], Escape) + Ctrl combos.
  const extraKeys = useMemo(
    () => ({
      m: () => {
        const s = useCues.getState();
        s.addCue(s.activeType, useEditor.getState().playheadMs);
      },
      M: () => {
        const s = useCues.getState();
        s.addCue(s.activeType, useEditor.getState().playheadMs);
      },
      Delete: () => useCues.getState().deleteSelected(),
      Backspace: () => useCues.getState().deleteSelected(),
      Escape: () => useCues.getState().clearSelection(),
      "[": () => jumpToCue(adapter, -1),
      "]": () => jumpToCue(adapter, +1),
    }),
    [adapter],
  );
  useKeyboardShortcuts(adapter, extraKeys);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
        if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        save();
      } else if (k === "z" && e.shiftKey) {
        e.preventDefault();
        cueHistory.redo();
      } else if (k === "z") {
        e.preventDefault();
        cueHistory.undo();
      } else if (k === "y") {
        e.preventDefault();
        cueHistory.redo();
      } else if (k === "a") {
        e.preventDefault();
        useCues.getState().selectAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function onReselect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileError(null);
    try {
      const d = await probeVideoDuration(f);
      if (durationMs && Math.abs(d - durationMs) > 1500) {
        setFileError(
          `This file is ${formatShort(d)} but the project expects ${formatShort(durationMs)}. Pick the same export, or continue and re-check your cues.`,
        );
      }
      setFile(video.id, f);
    } catch (err) {
      setFileError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-warning/40 bg-warning/10 rounded-md border px-3 py-2 text-xs lg:hidden">
        The timeline editor is designed for a desktop browser (≥ 1024 px). It works here, but
        dragging and keyboard shortcuts are easier on a larger screen.
      </div>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{video.name}</h1>
        <StatusPill status={video.status} />
        {durationMs ? <Pill>{formatShort(durationMs)}</Pill> : null}
        <Pill tone={video.youtubeVideoId ? "accent" : "warning"}>
          {video.youtubeVideoId ? `YouTube · ${video.youtubeVideoId}` : "Not linked to YouTube"}
        </Pill>
        {sheetVersion ? <Pill>v{sheetVersion}</Pill> : <Pill tone="neutral">unsaved</Pill>}
        {dirty && <Pill tone="warning">unsaved changes</Pill>}
        <div className="ml-auto flex items-center gap-2">
          {saveState.error && <span className="text-danger text-xs">{saveState.error}</span>}
          <Button
            size="sm"
            onClick={save}
            disabled={saveState.busy || !dirty}
            title="Save (Ctrl+S)"
          >
            {saveState.busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" size="sm" href={`/projects/${video.id}/publish`}>
            Link &amp; publish
          </Button>
        </div>
      </header>

      {draft && (
        <div className="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
          <span>
            A local draft from {new Date(draft.savedAt).toLocaleString()} is newer than the saved
            version ({draft.cues.length} cues).
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                useCues.getState().load(draft.cues, { sheetVersion, dirty: true });
                cueHistory.clear();
              }}
            >
              Restore draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearDraft(video.id);
                useCues.getState().offerDraft(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-3">
          {source ? (
            <div className="relative">
              <VideoStage source={source} onAdapter={onAdapter} />
              <PreviewOverlay adapter={adapter} />
            </div>
          ) : (
            <label className="border-border bg-bg-elev hover:border-fg-muted flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
              <input type="file" accept="video/*" className="sr-only" onChange={onReselect} />
              <span className="text-sm font-medium">Re-select the local video</span>
              <span className="text-fg-muted max-w-sm text-xs">
                Local files stay in the browser, so they need to be chosen again after a reload.
                {video.localFileName ? ` Expected: ${video.localFileName}` : ""}
              </span>
            </label>
          )}
          {fileError && <div className="text-warning text-xs">{fileError}</div>}
          <Transport adapter={adapter} />
        </div>

        <div className="flex flex-col gap-3">
          <CueInspector adapter={adapter} />
          {!validation.ok && (
            <div className="border-danger/40 bg-danger/10 rounded-lg border p-3 text-xs">
              <div className="text-danger mb-1 font-medium">
                {validation.errors.length} problem{validation.errors.length === 1 ? "" : "s"} block
                saving
              </div>
              <ul className="text-danger/90 space-y-0.5">
                {validation.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    {e.cueId ? `${e.cueId}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Timeline adapter={adapter} invalidIds={invalidIds} file={fileEntry?.file} />
      <p className="text-fg-muted text-xs">
        Space play/pause · ←/→ frame · Shift+←/→ 1 s · M add cue · Del delete · [ ] prev/next cue ·
        double-click a lane to add · drag to move · Shift+drag for marquee · Ctrl+wheel zoom ·
        Ctrl+Z/Y undo/redo · Ctrl+S save
      </p>
    </div>
  );
}

/** Seek to the previous (-1) or next (+1) cue relative to the playhead. */
function jumpToCue(adapter, dir) {
  if (!adapter) return;
  const { cues } = useCues.getState();
  const ph = useEditor.getState().playheadMs;
  const target =
    dir < 0 ? [...cues].reverse().find((c) => c.at < ph - 1) : cues.find((c) => c.at > ph + 1);
  if (target) {
    adapter.pause();
    adapter.seek(target.at);
    useCues.getState().select(target.id);
  }
}
