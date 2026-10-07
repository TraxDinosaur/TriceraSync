// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { notFound } from "next/navigation";
import { PublishPanel } from "@/components/publish/PublishPanel";
import { HttpError } from "@/lib/http/errors";
import { getVideo, listCueSheets } from "@/lib/videos/repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    return { title: `Publish · ${(await getVideo(id)).name}` };
  } catch {
    return { title: "Publish" };
  }
}

export default async function PublishPage({ params }) {
  const { id } = await params;
  let video;
  try {
    video = await getVideo(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const sheets = await listCueSheets(id);
  const json = (v) => JSON.parse(JSON.stringify(v));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{video.name}</h1>
        <p className="text-fg-muted text-sm">
          Link the published YouTube video so viewers&apos; devices can find this cue sheet, then
          publish a version.
        </p>
      </div>
      <PublishPanel video={json(video)} sheets={json(sheets)} appUrl={appUrl} />
    </section>
  );
}
