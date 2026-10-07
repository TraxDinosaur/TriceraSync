// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { create } from "zustand";

const AUTO_DISMISS_MS = 4000;
let seq = 0;

/** Tiny toast queue. Call `toast.success("…")` / `toast.error("…")` from anywhere on the client. */
export const useToasts = create((set) => ({
  items: [],
  push(tone, message) {
    const id = ++seq;
    set((s) => ({ items: [...s.items, { id, tone, message }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), AUTO_DISMISS_MS);
  },
  dismiss(id) {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (m) => useToasts.getState().push("success", m),
  error: (m) => useToasts.getState().push("danger", m),
  info: (m) => useToasts.getState().push("neutral", m),
};

const TONES = {
  success: "border-success/40 bg-success/15 text-success",
  danger: "border-danger/40 bg-danger/15 text-danger",
  neutral: "border-border bg-bg-elev-2 text-fg",
};

/** Mount once in the root layout. */
export function ToastViewport() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-sm rounded-md border px-3 py-2 text-left text-sm shadow-lg backdrop-blur ${TONES[t.tone]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
