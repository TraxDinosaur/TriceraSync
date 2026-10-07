// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

const inputCls =
  "bg-bg border-border text-fg placeholder:text-fg-muted/60 focus:border-accent h-9 w-full rounded-md border px-3 text-sm outline-none transition-colors disabled:opacity-50";

/** Labelled input with optional hint / error line. */
export function Field({ label, hint, error, id, className = "", ...input }) {
  return (
    <label htmlFor={id} className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-fg-muted text-xs font-medium tracking-wide uppercase">{label}</span>
      <input id={id} className={`${inputCls} ${error ? "border-danger" : ""}`} {...input} />
      {error ? (
        <span className="text-danger text-xs">{error}</span>
      ) : hint ? (
        <span className="text-fg-muted text-xs">{hint}</span>
      ) : null}
    </label>
  );
}

export { inputCls };
