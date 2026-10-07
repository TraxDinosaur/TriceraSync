// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/Button";
import { CUE_LABELS, LANE_ORDER, defaultCue, isStateCue } from "@/lib/pcf/defaults";
import { validateCue } from "@/lib/pcf/validate";
import { frameMs, formatTime } from "@/lib/time/format";
import { selectSelectedCues, useCues } from "@/store/cueStore";
import { useEditor } from "@/store/editorStore";
import { CheckboxField, NumberField, SelectField, historyGroupHandlers } from "./fields";
import { FlashParams } from "./params/FlashParams";
import { LevelParams } from "./params/LevelParams";
import { TorchParams } from "./params/TorchParams";
import { VibrateParams } from "./params/VibrateParams";
import { PresetPicker } from "./PresetPicker";

const TYPE_OPTIONS = LANE_ORDER.map((t) => ({ value: t, label: CUE_LABELS[t] }));

/** Right-hand panel: edits the selected cue with live validation (FR-13/14), bulk tools, presets. */
export function CueInspector({ adapter }) {
  // useShallow: the selector builds a new array; shallow-compare keeps the snapshot stable.
  const selected = useCues(useShallow(selectSelectedCues));
  if (selected.length === 0) {
    return (
      <Panel title="Cue inspector">
        <p className="text-fg-muted text-xs">
          Select a cue on the timeline to edit it, or press <kbd>M</kbd> to add one at the playhead.
        </p>
        <PresetPicker />
      </Panel>
    );
  }
  if (selected.length > 1) return <BulkPanel cues={selected} />;
  return <SinglePanel cue={selected[0]} adapter={adapter} />;
}

function Panel({ title, children, right }) {
  return (
    <aside className="border-border bg-bg-elev flex flex-col gap-4 rounded-lg border p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-fg font-medium">{title}</div>
        {right}
      </div>
      {children}
    </aside>
  );
}

function NudgeRow({ ids }) {
  const fps = useEditor((s) => s.fps);
  const move = (d) =>
    useCues.getState().moveCues(ids, d, useEditor.getState().durationMs ?? undefined);
  const f = Math.round(frameMs(fps));
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-fg-muted mr-1 text-[11px] uppercase">Nudge</span>
      <Button variant="secondary" size="sm" onClick={() => move(-f)} title={`−1 frame (${f} ms)`}>
        −1f
      </Button>
      <Button variant="secondary" size="sm" onClick={() => move(-10)}>
        −10 ms
      </Button>
      <Button variant="secondary" size="sm" onClick={() => move(10)}>
        +10 ms
      </Button>
      <Button variant="secondary" size="sm" onClick={() => move(f)} title={`+1 frame (${f} ms)`}>
        +1f
      </Button>
    </div>
  );
}

function BulkPanel({ cues }) {
  const ids = cues.map((c) => c.id);
  return (
    <Panel
      title={`${cues.length} cues selected`}
      right={
        <Button variant="danger" size="sm" onClick={() => useCues.getState().deleteCues(ids)}>
          Delete
        </Button>
      }
    >
      <div className="text-fg-muted text-xs">
        {formatTime(cues[0].at)} → {formatTime(cues[cues.length - 1].at)}
      </div>
      <NudgeRow ids={ids} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const ph = useEditor.getState().playheadMs;
          useCues
            .getState()
            .moveCues(ids, ph - cues[0].at, useEditor.getState().durationMs ?? undefined);
        }}
      >
        Move first cue to playhead
      </Button>
    </Panel>
  );
}

function SinglePanel({ cue, adapter }) {
  const [group] = useState(() => historyGroupHandlers());
  const validation = useMemo(() => validateCue(cue), [cue]);
  const errors = useMemo(
    () => Object.fromEntries(validation.errors.map((e) => [e.path, e.message])),
    [validation],
  );
  const err = (path) => errors[path];
  const update = (patch) => useCues.getState().updateCue(cue.id, patch);
  const setParams = (patch) => update({ params: { ...cue.params, ...patch } });
  const replaceParams = (params) => update({ params });
  const changeType = (type) => {
    if (type === cue.type) return;
    const next = { ...defaultCue(type, cue.at), id: cue.id };
    useCues.getState().replaceCue(cue.id, next);
  };
  const stateCue = isStateCue(cue);

  return (
    <Panel
      title={CUE_LABELS[cue.type]}
      right={
        <div className="flex items-center gap-1">
          <span className="text-fg-muted font-mono text-[11px]">{cue.id}</span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => useCues.getState().deleteCues([cue.id])}
            title="Delete (Del)"
          >
            Delete
          </Button>
        </div>
      }
    >
      <SelectField label="Type" value={cue.type} options={TYPE_OPTIONS} onChange={changeType} />

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <NumberField
          label="At"
          value={cue.at}
          min={0}
          suffix="ms"
          onChange={(v) => v != null && update({ at: v })}
          error={err("at")}
          group={group}
        />
        <div className="flex gap-1 pb-0.5">
          <Button
            variant="secondary"
            size="sm"
            title="Set to playhead"
            onClick={() => update({ at: useEditor.getState().playheadMs })}
          >
            ⇤ playhead
          </Button>
          <Button
            variant="secondary"
            size="sm"
            title="Seek to cue"
            onClick={() => {
              adapter?.pause();
              adapter?.seek(cue.at);
            }}
          >
            go
          </Button>
        </div>
      </div>
      <div className="text-fg-muted -mt-2 font-mono text-[11px]">{formatTime(cue.at)}</div>

      {stateCue && (
        <div className="flex flex-col gap-2">
          <CheckboxField
            label="Hold, then restore previous value"
            checked={cue.durationMs != null}
            onChange={(on) => update({ durationMs: on ? 2000 : undefined })}
          />
          {cue.durationMs != null && (
            <NumberField
              label="Hold for"
              value={cue.durationMs}
              min={16}
              suffix="ms"
              onChange={(v) => v != null && update({ durationMs: v })}
              error={err("durationMs")}
              group={group}
            />
          )}
        </div>
      )}

      <div className="border-border flex flex-col gap-3 border-t pt-3">
        {cue.type === "vibrate" && (
          <VibrateParams
            params={cue.params}
            setParams={setParams}
            replaceParams={replaceParams}
            err={err}
            group={group}
          />
        )}
        {(cue.type === "brightness" || cue.type === "volume") && (
          <LevelParams params={cue.params} setParams={setParams} err={err} group={group} />
        )}
        {cue.type === "flash" && (
          <FlashParams params={cue.params} setParams={setParams} err={err} group={group} />
        )}
        {cue.type === "torch" && (
          <TorchParams params={cue.params} setParams={setParams} err={err} group={group} />
        )}
      </div>

      {!validation.ok && (
        <ul className="text-danger space-y-0.5 text-[11px]">
          {validation.errors.map((e, i) => (
            <li key={i}>
              {e.path}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <div className="border-border border-t pt-3">
        <NudgeRow ids={[cue.id]} />
      </div>
    </Panel>
  );
}
