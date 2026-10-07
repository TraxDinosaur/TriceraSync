// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading editor">
      <div className="bg-bg-elev h-7 w-64 animate-pulse rounded" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="bg-bg-elev aspect-video w-full animate-pulse rounded-lg" />
          <div className="bg-bg-elev h-12 animate-pulse rounded-lg" />
        </div>
        <div className="bg-bg-elev h-64 animate-pulse rounded-lg" />
      </div>
      <div className="bg-bg-elev h-64 animate-pulse rounded-lg" />
    </div>
  );
}
