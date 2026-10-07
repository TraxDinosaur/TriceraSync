// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { formatShort } from "@/lib/time/format";
import { parseYouTubeVideoId } from "@/lib/youtube/parseUrl";
import { probeVideoDuration, useProjectFiles } from "@/store/projectFilesStore";

const SOURCES = [
  {
    id: "local",
    title: "Local file",
    body: "The export you are about to upload. Stays in this browser — nothing is sent to the server.",
  },
  {
    id: "youtube",
    title: "YouTube link",
    body: "A video that is already on YouTube (public or unlisted). Played via the embedded player.",
  },
];

/** Source picker — PRD FR-01..03. */
export function NewProjectForm() {
  const router = useRouter();
  const setFile = useProjectFiles((s) => s.setFile);
  const [source, setSource] = useState("local");
  const [name, setName] = useState("");
  const [file, setFileState] = useState(null);
  const [durationMs, setDurationMs] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onPickFile(e) {
    const f = e.target.files?.[0];
    setFileState(f ?? null);
    setDurationMs(null);
    setError(null);
    if (!f) return;
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    try {
      setDurationMs(await probeVideoDuration(f));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onPreviewYouTube() {
    setError(null);
    setMeta(null);
    if (!parseYouTubeVideoId(youtubeUrl)) {
      setError("That does not look like a YouTube video URL.");
      return;
    }
    setBusy(true);
    try {
      const m = await api.post("/api/youtube/metadata", { youtubeUrl });
      setMeta(m);
      if (!name) setName(m.title);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body =
        source === "local"
          ? { name, source, localFileName: file?.name, durationMs: durationMs ?? undefined }
          : { name, source, youtubeUrl };
      const video = await api.post("/api/videos", body);
      if (source === "local" && file) setFile(video.id, file);
      router.push(`/projects/${video.id}`);
    } catch (err) {
      const msg = err.details?.existingVideoId
        ? `${err.message} (${err.details.existingName})`
        : err.message;
      setError(msg);
      toast.error(msg);
      setBusy(false);
    }
  }

  const canCreate =
    name.trim().length > 0 && !busy && (source === "local" ? !!file && durationMs != null : !!meta);

  return (
    <form onSubmit={onCreate} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSource(s.id);
              setError(null);
            }}
            aria-pressed={source === s.id}
            className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors ${
              source === s.id
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-elev hover:border-fg-muted"
            }`}
          >
            <span className="text-sm font-medium">{s.title}</span>
            <span className="text-fg-muted text-xs">{s.body}</span>
          </button>
        ))}
      </div>

      {source === "local" ? (
        <div className="flex flex-col gap-3">
          <label className="border-border bg-bg-elev hover:border-fg-muted flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-8 text-center">
            <input type="file" accept="video/*" className="sr-only" onChange={onPickFile} />
            <span className="text-sm font-medium">{file ? file.name : "Choose a video file"}</span>
            <span className="text-fg-muted text-xs">
              {file
                ? durationMs != null
                  ? `${formatShort(durationMs)} · ${(file.size / 1e6).toFixed(1)} MB · stays on this machine`
                  : "Reading duration…"
                : "MP4 / WebM / MOV — never uploaded"}
            </span>
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <Field
              id="yt-url"
              label="YouTube URL"
              placeholder="https://youtu.be/…"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setMeta(null);
              }}
              className="flex-1"
            />
            <Button variant="secondary" onClick={onPreviewYouTube} disabled={busy || !youtubeUrl}>
              Fetch
            </Button>
          </div>
          {meta && (
            <div className="border-border bg-bg-elev flex gap-3 rounded-lg border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
              <img src={meta.thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{meta.title}</div>
                <div className="text-fg-muted truncate text-xs">{meta.channel}</div>
                <div className="text-fg-muted mt-1 text-xs">
                  Duration is read from the player once the editor opens.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Field
        id="name"
        label="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Ranked clutch — episode 12"
        maxLength={120}
      />

      {error && <div className="text-danger text-sm">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" href="/">
          Cancel
        </Button>
        <Button type="submit" disabled={!canCreate}>
          {busy ? "Creating…" : "Open editor"}
        </Button>
      </div>
    </form>
  );
}
