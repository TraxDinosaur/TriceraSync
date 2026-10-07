// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { notFound } from "next/navigation";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { HttpError } from "@/lib/http/errors";
import { getCueSheet, getVideo } from "@/lib/videos/repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const video = await getVideo(id);
    return { title: video.name };
  } catch {
    return { title: "Project" };
  }
}

export default async function EditorPage({ params }) {
  const { id } = await params;
  let video;
  try {
    video = await getVideo(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const sheet = await getCueSheet(id);
  // Dates → ISO strings so the client component receives plain JSON.
  const json = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  return <EditorWorkspace video={json(video)} initialSheet={json(sheet)} />;
}
