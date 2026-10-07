// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import Link from "next/link";

const VARIANTS = {
  primary: "bg-accent text-accent-fg hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(255,106,42,0.8)] disabled:opacity-50 disabled:shadow-none",
  secondary: "bg-bg-elev-2 text-fg border border-border hover:border-fg-muted disabled:opacity-50",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-elev-2 disabled:opacity-50",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50",
};

const SIZES = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "size-8 text-sm",
};

/** Button or link (when `href` is set) with shared visual variants. */
export function Button({
  variant = "primary",
  size = "md",
  href,
  className = "",
  children,
  ...rest
}) {
  const cls = `inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
