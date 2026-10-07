// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { ResolveActivity } from "./ResolveActivity";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { formatShort } from "@/lib/time/format";
import { parseYouTubeVideoId } from "@/lib/youtube/parseUrl";

const MISMATCH_MS = 1500;

/**
 * Link & publish (PRD FR-16..19, §6.1 step 5): preview metadata for a YouTube URL, confirm the
 * match key, pick a sheet version, publish / unpublish, and copy a resolve test command.
 */
export function PublishPanel({ video, sheets, appUrl }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(
    sheets.find((s) => s.isActive)?.sheetVersion ?? sheets[0]?.sheetVersion ?? null,
  );

  const linked = !!video.youtubeVideoId;
  const durationMs = video.durationMs;
  const mismatch =
    meta?.durationMs != null &&
    durationMs != null &&
    Math.abs(meta.durationMs - durationMs) > MISMATCH_MS;

  async function fetchMeta() {
    setError(null);
    setMeta(null);
    if (!parseYouTubeVideoId(url)) {
      setError("That does not look like a YouTube video URL.");
      return;
    }
    setBusy(true);
    try {
      setMeta(
        await api.post("/api/youtube/metadata", {
          youtubeUrl: url,
          durationMs: durationMs ?? undefined,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function run(fn, successMessage) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
      if (successMessage) toast.success(successMessage);
    } catch (e) {
      const msg = e.details?.existingName ? `${e.message} (${e.details.existingName})` : e.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const link = () =>
    run(async () => {
      await api.patch(`/api/videos/${video.id}`, {
        youtubeUrl: url,
        durationMs: durationMs ?? undefined,
      });
      setMeta(null);
      setUrl("");
    }, "YouTube video linked");
  const publish = () =>
    run(
      () => api.post(`/api/videos/${video.id}/publish`, { sheetVersion: version }),
      `Published v${version}`,
    );
  const unpublish = () =>
    run(() => api.post(`/api/videos/${video.id}/unpublish`), "Unpublished — viewers get 404 now");

  const resolveUrl = linked
    ? `${appUrl}/api/v1/resolve?${new URLSearchParams({
        title: video.title ?? "",
        channel: video.channelName ?? "",
        durationMs: String(durationMs ?? ""),
      })}`
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Step 1 — link */}
      <section className="border-border bg-bg-elev flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">1 · YouTube link</h2>
          <Pill tone={linked ? "success" : "warning"}>{linked ? "Linked" : "Not linked"}</Pill>
        </div>

        {linked && (
          <MatchKeyCard
            title={video.title}
            channel={video.channelName}
            videoId={video.youtubeVideoId}
            durationMs={durationMs}
            thumbnailUrl={`https://i.ytimg.com/vi/${video.youtubeVideoId}/mqdefault.jpg`}
            label="Current match key"
          />
        )}

        <div className="flex items-end gap-2">
          <Field
            id="yt"
            label={linked ? "Replace with another URL" : "Paste the published video URL"}
            placeholder="https://youtu.be/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setMeta(null);
            }}
            className="flex-1"
          />
          <Button variant="secondary" onClick={fetchMeta} disabled={busy || !url}>
            Fetch
          </Button>
        </div>

        {meta && (
          <>
            <MatchKeyCard
              title={meta.title}
              channel={meta.channel}
              videoId={meta.videoId}
              durationMs={durationMs}
              thumbnailUrl={meta.thumbnailUrl}
              label={`Preview · ${meta.source}`}
            />
            {mismatch && (
              <div className="border-warning/40 bg-warning/10 rounded-md border p-3 text-xs">
                YouTube reports {formatShort(meta.durationMs)} but this project is{" "}
                {formatShort(durationMs)}. If you re-cut the video, your cues will drift — link
                anyway only if you know this is the same export.
              </div>
            )}
            {durationMs == null && (
              <div className="border-warning/40 bg-warning/10 rounded-md border p-3 text-xs">
                This project has no duration yet. Open the editor once so the player can report it;
                publishing requires it.
              </div>
            )}
            <Button onClick={link} disabled={busy}>
              {linked ? "Replace link" : "Link this video"}
            </Button>
          </>
        )}
      </section>

      {/* Step 2 — publish */}
      <section className="border-border bg-bg-elev flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">2 · Publish</h2>
          <StatusPill status={video.status} />
        </div>

        {sheets.length === 0 ? (
          <p className="text-fg-muted text-sm">
            No cue sheet saved yet. Add cues in the editor and press Save first.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-fg-muted text-[11px] font-medium tracking-wide uppercase">
              Sheet version to publish
            </span>
            {sheets.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  version === s.sheetVersion ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="version"
                  className="accent-accent"
                  checked={version === s.sheetVersion}
                  onChange={() => setVersion(s.sheetVersion)}
                />
                <span className="font-mono">v{s.sheetVersion}</span>
                <span className="text-fg-muted">{s.cueCount} cues</span>
                <span className="text-fg-muted ml-auto text-xs">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
                {s.isActive && <Pill tone="success">active</Pill>}
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={publish}
            disabled={busy || !linked || durationMs == null || version == null}
            title={
              !linked ? "Link a YouTube URL first" : durationMs == null ? "Duration missing" : ""
            }
          >
            {video.status === "published" ? "Publish selected version" : "Publish"}
          </Button>
          {video.status === "published" && (
            <Button variant="secondary" onClick={unpublish} disabled={busy}>
              Unpublish
            </Button>
          )}
          <Button variant="ghost" href={`/projects/${video.id}`}>
            Back to editor
          </Button>
        </div>

        {resolveUrl && (
          <div className="flex flex-col gap-1.5">
            <span className="text-fg-muted text-[11px] font-medium tracking-wide uppercase">
              Test what the Engine will ask
            </span>
            <code className="bg-bg border-border block overflow-x-auto rounded-md border p-2 font-mono text-[11px] break-all whitespace-pre-wrap">
              curl -s &quot;{resolveUrl}&quot;
            </code>
            <span className="text-fg-muted text-xs">
              Returns the PCF sheet with <code>match.confidence</code> once published; 404 while
              draft.
            </span>
          </div>
        )}
      </section>

      {error && <div className="text-danger text-sm lg:col-span-2">{error}</div>}

      <ResolveActivity
        videoId={video.id}
        expected={{ durationMs, title: video.title, channel: video.channelName }}
      />
    </div>
  );
}

function MatchKeyCard({ title, channel, videoId, durationMs, thumbnailUrl, label }) {
  return (
    <div className="border-border bg-bg flex gap-3 rounded-md border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
      <img src={thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
      <div className="min-w-0 text-sm">
        <div className="text-fg-muted text-[11px] tracking-wide uppercase">{label}</div>
        <div className="truncate font-medium">{title || "—"}</div>
        <div className="text-fg-muted truncate text-xs">{channel || "—"}</div>
        <div className="text-fg-muted mt-1 font-mono text-xs">
          {videoId} · {durationMs != null ? formatShort(durationMs) : "duration unknown"}
        </div>
      </div>
    </div>
  );
}
