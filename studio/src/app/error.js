// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { Button } from "@/components/ui/Button";

/** Route-segment error boundary (server or render errors). */
export default function ErrorPage({ error, reset }) {
  return (
    <div className="border-danger/40 bg-danger/10 flex flex-col items-start gap-3 rounded-lg border p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-fg-muted text-sm">
        {error?.message ?? "Unexpected error."}
        {error?.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" href="/">
          Back to projects
        </Button>
      </div>
    </div>
  );
}
