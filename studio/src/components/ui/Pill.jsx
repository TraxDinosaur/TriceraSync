// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

const TONES = {
  neutral: "bg-bg-elev-2 text-fg-muted border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  accent: "bg-accent/15 text-accent border-accent/30",
};

export function Pill({ tone = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }) {
  return status === "published" ? (
    <Pill tone="success">Published</Pill>
  ) : (
    <Pill tone="neutral">Draft</Pill>
  );
}
