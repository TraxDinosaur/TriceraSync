// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="border-border bg-bg-elev flex flex-col items-start gap-3 rounded-lg border p-6">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-fg-muted text-sm">That project does not exist or was deleted.</p>
      <Button href="/">Back to projects</Button>
    </div>
  );
}
