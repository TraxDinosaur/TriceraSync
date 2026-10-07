// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="bg-bg-elev h-8 w-48 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-bg-elev animate-pulse rounded-lg border">
            <div className="bg-bg-elev-2 aspect-video w-full" />
            <div className="flex flex-col gap-2 p-3">
              <div className="bg-bg-elev-2 h-4 w-2/3 rounded" />
              <div className="bg-bg-elev-2 h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
