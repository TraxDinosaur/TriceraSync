// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useEffect, useRef, useState } from "react";
import { LocalPlayerAdapter } from "@/lib/player/LocalPlayerAdapter";
import { YouTubePlayerAdapter } from "@/lib/player/YouTubePlayerAdapter";

/**
 * Renders the video surface for a source and hands the created PlayerAdapter to the parent.
 * @param {{ source: { type: "local", url: string } | { type: "youtube", videoId: string },
 *           onAdapter: (adapter: import("@/lib/player/PlayerAdapter").PlayerAdapter | null) => void }} props
 */
export function VideoStage({ source, onAdapter }) {
  const hostRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !source) return;
    setError(null);
    host.replaceChildren();

    let adapter;
    if (source.type === "local") {
      const video = document.createElement("video");
      video.src = source.url;
      video.controls = false;
      video.playsInline = true;
      video.preload = "auto";
      video.className = "h-full w-full bg-black";
      host.appendChild(video);
      adapter = new LocalPlayerAdapter(video);
    } else {
      const mount = document.createElement("div");
      mount.className = "h-full w-full";
      host.appendChild(mount);
      adapter = new YouTubePlayerAdapter(mount, source.videoId);
    }
    const offError = adapter.on("error", (e) => setError(e.message));
    onAdapter(adapter);
    return () => {
      offError();
      onAdapter(null);
      adapter.destroy();
      host.replaceChildren();
    };
  }, [source, onAdapter]);

  return (
    <div className="border-border relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
      <div ref={hostRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      {error && (
        <div className="bg-danger/90 absolute inset-x-0 bottom-0 px-3 py-1.5 text-xs text-white">
          {error}
        </div>
      )}
    </div>
  );
}
