// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api/client";
import { formatShort } from "@/lib/time/format";

const POLL_MS = 4000;

const TONE = { exact: "success", "title-only": "accent", fuzzy: "warning", id: "success" };
const LOCKED = "locked";

/**
 * Live tail of the public resolve API. A creator can play the video on their phone and watch
 * the request arrive — and when it misses, see exactly which title / duration was sent.
 */
export function ResolveActivity({ videoId, expected }) {
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(true);
  const [error, setError] = useState(null);

  // Polling is modelled as a subscription: the request is kicked off synchronously and state is
  // only touched from the promise callbacks, so no render is triggered from the effect body.
  const load = useCallback(
    (isCancelled = () => false) =>
      api.get(`/api/videos/${videoId}/resolves`).then(
        (data) => {
          if (isCancelled()) return;
          setRows(data);
          setError(null);
        },
        (e) => {
          // A locked studio is an expected state for a visitor, not a failure to shout about.
          if (!isCancelled()) setError(e.status === 401 ? LOCKED : e.message);
        },
      ),
    [videoId],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    load(isCancelled);
    const t = live ? setInterval(() => load(isCancelled), POLL_MS) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [load, live]);

  return (
    <section className="border-border bg-bg-elev flex flex-col gap-3 rounded-lg border p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">Recent lookups</h2>
        <span className="text-fg-muted text-xs">
          What devices asked the resolve API for. Play the video on your phone and watch it appear.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLive((v) => !v)}>
            {live ? "Pause" : "Resume"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => load()}>
            Refresh
          </Button>
        </div>
      </div>

      {error === LOCKED ? (
        <p className="text-fg-muted text-sm">
          Unlock the studio to see which devices have asked for this cue sheet.
        </p>
      ) : error ? (
        <div className="text-danger text-xs">{error}</div>
      ) : null}

      {error === LOCKED ? null : rows.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Nothing yet. Point the Engine at this server and play the video.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="text-fg-muted">
              <tr className="border-border border-b">
                <th className="py-1.5 pr-3 font-medium">When</th>
                <th className="py-1.5 pr-3 font-medium">Title</th>
                <th className="py-1.5 pr-3 font-medium">Channel</th>
                <th className="py-1.5 pr-3 font-medium">Duration</th>
                <th className="py-1.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const drift =
                  expected?.durationMs != null && r.durationMs != null
                    ? r.durationMs - expected.durationMs
                    : null;
                return (
                  <tr key={r.id} className="border-border/60 border-b last:border-0">
                    <td className="text-fg-muted py-1.5 pr-3 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="max-w-[18rem] truncate py-1.5 pr-3" title={r.title ?? ""}>
                      {r.title ?? "—"}
                    </td>
                    <td className="text-fg-muted max-w-[10rem] truncate py-1.5 pr-3">
                      {r.channel ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                      {r.durationMs != null ? formatShort(r.durationMs) : "—"}
                      {drift != null && drift !== 0 && (
                        <span className={Math.abs(drift) > 1500 ? "text-danger" : "text-fg-muted"}>
                          {" "}
                          ({drift > 0 ? "+" : ""}
                          {drift} ms)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {r.confidence ? (
                        <Pill tone={TONE[r.confidence] ?? "neutral"}>{r.confidence}</Pill>
                      ) : (
                        <Pill tone="danger">no match</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-fg-muted text-xs">
        A miss with a duration inside ±1.5 s of this project usually means the title differs; a
        larger drift means the device is playing something else (a pre-roll ad, or a re-uploaded
        cut).
      </p>
    </section>
  );
}
