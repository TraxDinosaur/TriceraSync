// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { CueRunner, stateCueAt } from "../preview/runner.js";

const cues = [
  { id: "c_v1", at: 1000, type: "vibrate", params: { mode: "oneShot", durationMs: 100 } },
  { id: "c_b1", at: 2000, type: "brightness", durationMs: 1000, params: { level: 0.2 } },
  { id: "c_f1", at: 2500, type: "flash", params: { color: "#FF0000", durationMs: 100 } },
  { id: "c_vol", at: 3000, type: "volume", params: { level: 0.5 } },
  { id: "c_b2", at: 4000, type: "brightness", params: { level: 0.8 } },
  { id: "c_b3", at: 5000, type: "brightness", durationMs: 500, params: { level: 0.1 } },
];

describe("stateCueAt", () => {
  test("baseline before any cue", () => expect(stateCueAt(cues, "brightness", 0)).toBeNull());
  test("held cue active inside its window", () =>
    expect(stateCueAt(cues, "brightness", 2500).id).toBe("c_b1"));
  test("held cue reverts to baseline after its window", () =>
    expect(stateCueAt(cues, "brightness", 3500)).toBeNull());
  test("persistent cue stays", () => expect(stateCueAt(cues, "brightness", 4500).id).toBe("c_b2"));
  test("held cue overrides persistent, then reverts to it", () => {
    expect(stateCueAt(cues, "brightness", 5200).id).toBe("c_b3");
    expect(stateCueAt(cues, "brightness", 5600).id).toBe("c_b2");
  });
  test("volume persists to the end", () =>
    expect(stateCueAt(cues, "volume", 99_999).id).toBe("c_vol"));
});

function make() {
  const fired = [];
  const states = [];
  const r = new CueRunner({
    onFire: (c) => fired.push(c.id),
    onState: (type, c) => states.push(`${type}:${c ? c.id : "-"}`),
  });
  r.setCues(cues);
  return { r, fired, states };
}

describe("CueRunner", () => {
  test("fires instant cues once when crossed, in order", () => {
    const { r, fired } = make();
    r.tick(0);
    r.tick(900);
    r.tick(1100); // crosses c_v1
    r.tick(2600); // crosses c_f1
    r.tick(2700);
    expect(fired).toEqual(["c_v1", "c_f1"]);
  });

  test("does not fire the cue exactly at the first tick position (needs a crossing)", () => {
    const { r, fired } = make();
    r.tick(1000);
    r.tick(1001);
    expect(fired).toEqual([]);
  });

  test("seek skips instant cues in the jumped range but applies state", () => {
    const { r, fired, states } = make();
    r.tick(0);
    r.seek(4500);
    expect(fired).toEqual([]);
    expect(states).toContain("brightness:c_b2");
    expect(states).toContain("volume:c_vol");
  });

  test("backward tick behaves as a seek and re-arms cues", () => {
    const { r, fired } = make();
    r.tick(0);
    r.tick(1500); // fires c_v1
    r.tick(500); // backwards → seek
    r.tick(1500); // fires c_v1 again
    expect(fired).toEqual(["c_v1", "c_v1"]);
  });

  test("state changes are reported only on change, incl. revert to baseline", () => {
    const { r, states } = make();
    r.tick(0);
    r.tick(2100); // brightness c_b1 on
    r.tick(2200); // no change
    r.tick(3100); // c_b1 expired → baseline; volume on
    // Initial baseline is not reported (nothing changed from null).
    expect(states.filter((s) => s.startsWith("brightness"))).toEqual([
      "brightness:c_b1",
      "brightness:-",
    ]);
    expect(states.filter((s) => s.startsWith("volume"))).toEqual(["volume:c_vol"]);
  });

  test("reset clears state and reports baseline", () => {
    const { r, states } = make();
    r.tick(4500);
    states.length = 0;
    r.reset();
    expect(states.sort()).toEqual(["brightness:-", "volume:-"]);
  });
});
