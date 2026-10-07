// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { beforeEach, describe, expect, test } from "bun:test";
import { pickTickStep, snapMs, tickLabel, ticksFor, zoomBounds } from "../timeline/geometry.js";
import { cueHistory, useCues } from "../../store/cueStore.js";

describe("timeline geometry", () => {
  test("pickTickStep grows as zoom shrinks", () => {
    expect(pickTickStep(1)).toBe(100); // 1 px/ms → 100 ms ≥ 80 px
    expect(pickTickStep(0.1)).toBe(1000);
    expect(pickTickStep(0.001)).toBe(120_000);
  });

  test("ticksFor covers the range with majors on the step", () => {
    const { major, minor, ticks } = ticksFor(0.1, 0, 5000);
    expect(major).toBe(1000);
    expect(minor).toBe(200);
    const majors = ticks.filter((t) => t.major).map((t) => t.ms);
    expect(majors).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    expect(ticks.some((t) => !t.major && t.ms === 200)).toBe(true);
  });

  test("tickLabel", () => {
    expect(tickLabel(65_000, 5000)).toBe("1:05");
    expect(tickLabel(65_250, 50)).toBe("1:05.250");
  });

  test("zoomBounds: fit-all … 1 s across viewport", () => {
    const { min, max } = zoomBounds(1000, 100_000);
    expect(min).toBeCloseTo(0.01);
    expect(max).toBe(1);
  });

  test("snapMs picks the nearest candidate within threshold only", () => {
    const opts = { pxPerMs: 1, grid: 10, points: [1003] }; // threshold 8 ms
    expect(snapMs(1001, opts)).toBe(1000); // grid (1 ms away) beats point (2 ms away)
    expect(snapMs(1002, opts)).toBe(1003); // point (1 ms) beats grid (2 ms)
    expect(snapMs(1006, opts)).toBe(1003);
    expect(snapMs(1015, { pxPerMs: 1, grid: 10, points: [] })).toBe(1020);
    expect(snapMs(1050, { pxPerMs: 1, grid: null, points: [1000] })).toBe(1050); // too far
  });
});

describe("cue store", () => {
  beforeEach(() => {
    useCues.getState().load([]);
    cueHistory.clear();
  });

  test("addCue keeps cues sorted and selects the new one", () => {
    const s = useCues.getState();
    s.addCue("vibrate", 5000);
    const c = s.addCue("flash", 1000);
    expect(useCues.getState().cues.map((x) => x.at)).toEqual([1000, 5000]);
    expect(useCues.getState().selection.has(c.id)).toBe(true);
    expect(useCues.getState().dirty).toBe(true);
  });

  test("moveCues clamps the group to [0, duration]", () => {
    const s = useCues.getState();
    const a = s.addCue("vibrate", 1000);
    const b = s.addCue("vibrate", 3000);
    useCues.getState().moveCues([a.id, b.id], -5000, 10_000);
    expect(useCues.getState().cues.map((x) => x.at)).toEqual([0, 2000]);
    useCues.getState().moveCues([a.id, b.id], 20_000, 10_000);
    expect(useCues.getState().cues.map((x) => x.at)).toEqual([8000, 10_000]);
  });

  test("applyTimes sets absolute values and re-sorts", () => {
    const s = useCues.getState();
    const a = s.addCue("brightness", 1000);
    const b = s.addCue("brightness", 2000);
    useCues.getState().applyTimes({ [a.id]: { at: 5000, durationMs: 300 } });
    const cues = useCues.getState().cues;
    expect(cues[0].id).toBe(b.id);
    expect(cues[1]).toMatchObject({ id: a.id, at: 5000, durationMs: 300 });
  });

  test("undo/redo: a paused drag is one history step", () => {
    const s = useCues.getState();
    const a = s.addCue("vibrate", 1000); // step 1
    useCues.getState().applyTimes({ [a.id]: { at: 1100 } }); // step 2 (pre-drag recorded)
    cueHistory.pause();
    useCues.getState().applyTimes({ [a.id]: { at: 1200 } });
    useCues.getState().applyTimes({ [a.id]: { at: 1300 } });
    cueHistory.resume();
    expect(useCues.getState().cues[0].at).toBe(1300);
    cueHistory.undo();
    expect(useCues.getState().cues[0].at).toBe(1000); // whole drag undone
    cueHistory.undo();
    expect(useCues.getState().cues).toHaveLength(0);
    cueHistory.redo();
    expect(useCues.getState().cues[0].at).toBe(1000);
    cueHistory.redo();
    expect(useCues.getState().cues[0].at).toBe(1300);
  });

  test("selection: toggle, additive, deleteSelected", () => {
    const s = useCues.getState();
    const a = s.addCue("vibrate", 1);
    const b = s.addCue("vibrate", 2);
    useCues.getState().select(a.id);
    useCues.getState().select(b.id, { toggle: true });
    expect(useCues.getState().selection.size).toBe(2);
    useCues.getState().select(a.id, { toggle: true });
    expect([...useCues.getState().selection]).toEqual([b.id]);
    useCues.getState().deleteSelected();
    expect(useCues.getState().cues.map((c) => c.id)).toEqual([a.id]);
    expect(useCues.getState().selection.size).toBe(0);
  });

  test("selection is not part of undo history", () => {
    const s = useCues.getState();
    const a = s.addCue("vibrate", 1);
    useCues.getState().clearSelection();
    useCues.getState().select(a.id);
    cueHistory.undo(); // undoes addCue, not the selection changes
    expect(useCues.getState().cues).toHaveLength(0);
  });
});
