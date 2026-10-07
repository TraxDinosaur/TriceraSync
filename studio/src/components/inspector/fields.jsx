// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { inputCls } from "@/components/ui/Field";
import { cueHistory } from "@/store/cueStore";

/**
 * Focus-scoped undo grouping: the first change after focus is recorded normally (so undo can
 * return to the pre-edit value), subsequent keystrokes are merged until blur.
 */
export function historyGroupHandlers() {
  let touched = false;
  return {
    onFocus: () => {
      touched = false;
    },
    onBlur: () => {
      if (touched) cueHistory.resume();
      touched = false;
    },
    afterChange: () => {
      if (!touched) {
        touched = true;
        cueHistory.pause();
      }
    },
  };
}

function Label({ label, error, children, inline = false }) {
  return (
    <label className={`flex ${inline ? "items-center justify-between gap-3" : "flex-col gap-1"}`}>
      <span className="text-fg-muted text-[11px] font-medium tracking-wide uppercase">{label}</span>
      {children}
      {error && <span className="text-danger text-[11px]">{error}</span>}
    </label>
  );
}

export function NumberField({ label, value, onChange, error, min, max, step = 1, suffix, group }) {
  return (
    <Label label={label} error={error}>
      <div className="relative">
        <input
          type="number"
          className={`${inputCls} h-8 pr-9 font-mono text-xs ${error ? "border-danger" : ""}`}
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          onFocus={group?.onFocus}
          onBlur={group?.onBlur}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v !== null && Number.isNaN(v)) return;
            onChange(v);
            group?.afterChange();
          }}
        />
        {suffix && (
          <span className="text-fg-muted pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px]">
            {suffix}
          </span>
        )}
      </div>
    </Label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  error,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  group,
}) {
  return (
    <Label label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="accent-accent h-1.5 flex-1"
          value={value ?? min}
          min={min}
          max={max}
          step={step}
          onPointerDown={group?.onFocus}
          onPointerUp={group?.onBlur}
          onChange={(e) => {
            onChange(Number(e.target.value));
            group?.afterChange();
          }}
        />
        <span className="text-fg w-12 text-right font-mono text-xs tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
    </Label>
  );
}

export function SelectField({ label, value, onChange, options, error }) {
  return (
    <Label label={label} error={error}>
      <select
        className={`${inputCls} h-8 text-xs`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

export function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        className="accent-accent size-3.5"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** Comma-separated integer list (waveform timings / amplitudes). */
export function IntListField({ label, value, onChange, error, group }) {
  return (
    <Label label={label} error={error}>
      <input
        type="text"
        className={`${inputCls} h-8 font-mono text-xs ${error ? "border-danger" : ""}`}
        value={(value ?? []).join(", ")}
        onFocus={group?.onFocus}
        onBlur={group?.onBlur}
        onChange={(e) => {
          const list = e.target.value
            .split(/[,\s]+/)
            .filter((s) => s !== "")
            .map(Number);
          if (list.some((n) => Number.isNaN(n))) return;
          onChange(list);
          group?.afterChange();
        }}
        placeholder="0, 100, 50, 300"
      />
    </Label>
  );
}

export function ColorField({ label, value, onChange, error }) {
  return (
    <Label label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="border-border h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
          value={/^#[0-9A-Fa-f]{6}$/.test(value ?? "") ? value : "#ff0000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          className={`${inputCls} h-8 font-mono text-xs uppercase ${error ? "border-danger" : ""}`}
          value={value ?? ""}
          maxLength={7}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </div>
    </Label>
  );
}
