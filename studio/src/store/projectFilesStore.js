// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { create } from "zustand";

/**
 * Holds the creator's local video File per project — memory only, never persisted, never
 * uploaded (PRD FR-02). Object URLs are revoked when a file is replaced or cleared.
 */
export const useProjectFiles = create((set, get) => ({
  files: {},
  setFile(projectId, file) {
    const prev = get().files[projectId];
    if (prev) URL.revokeObjectURL(prev.url);
    set((s) => ({
      files: { ...s.files, [projectId]: { file, url: URL.createObjectURL(file) } },
    }));
  },
  clearFile(projectId) {
    const prev = get().files[projectId];
    if (prev) URL.revokeObjectURL(prev.url);
    set((s) => {
      const next = { ...s.files };
      delete next[projectId];
      return { files: next };
    });
  },
}));

/** Reads a video file's duration in ms without rendering it. */
export function probeVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (Number.isFinite(d) && d > 0) resolve(Math.round(d * 1000));
      else reject(new Error("could not read duration"));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not a playable video"));
    };
    v.src = url;
  });
}
