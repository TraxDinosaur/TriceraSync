// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link that highlights the section you are in. */
export function NavLink({ href, exact = false, children }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors ${
        active ? "bg-bg-elev-2 text-fg" : "text-fg-muted hover:text-fg hover:bg-bg-elev-2/60"
      }`}
    >
      {children}
    </Link>
  );
}
