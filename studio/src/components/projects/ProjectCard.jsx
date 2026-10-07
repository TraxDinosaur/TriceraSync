// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import Link from "next/link";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { formatShort } from "@/lib/time/format";

/** Dashboard tile for one project (FR-24). */
export function ProjectCard({ project }) {
  const thumb = project.youtubeVideoId
    ? `https://i.ytimg.com/vi/${project.youtubeVideoId}/mqdefault.jpg`
    : null;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="border-border bg-bg-elev hover:border-accent/60 group flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(255,106,42,0.6)]"
    >
      <div className="bg-bg-elev-2 relative aspect-video w-full">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, no optimization needed
          <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="text-fg-muted flex h-full items-center justify-center text-xs">
            Local file · {project.localFileName ?? "not linked"}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusPill status={project.status} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <div className="truncate text-sm font-medium">{project.name}</div>
        <div className="text-fg-muted truncate text-xs">
          {project.title ?? "No YouTube video linked yet"}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Pill>{project.cueCount ?? 0} cues</Pill>
          {project.latestSheetVersion ? <Pill>v{project.latestSheetVersion}</Pill> : null}
          {project.durationMs ? <Pill>{formatShort(project.durationMs)}</Pill> : null}
        </div>
      </div>
    </Link>
  );
}
