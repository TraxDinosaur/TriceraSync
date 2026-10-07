// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { validateCue, validateCues, validateDocument } from "../pcf/validate.js";
import { sortCues } from "../pcf/sort.js";
import { newCueId } from "../pcf/ids.js";
import { cueSheetInputSchema, DEFAULTS } from "../pcf/schema.js";

const sample = [
  {
    id: "c_01",
    at: 12340,
    type: "vibrate",
    params: { mode: "oneShot", durationMs: 200, amplitude: 255 },
  },
  {
    id: "c_02",
    at: 15000,
    type: "vibrate",
    params: {
      mode: "waveform",
      timings: [0, 100, 50, 300],
      amplitudes: [0, 255, 0, 180],
      repeat: -1,
    },
  },
  { id: "c_03", at: 16000, type: "vibrate", params: { mode: "predefined", effect: "HEAVY_CLICK" } },
  {
    id: "c_04",
    at: 20000,
    type: "brightness",
    durationMs: 4000,
    params: { level: 0.15, rampMs: 500 },
  },
  { id: "c_05", at: 25000, type: "volume", params: { level: 0.9, rampMs: 300 } },
  {
    id: "c_06",
    at: 30000,
    type: "flash",
    params: { color: "#FF0000", opacity: 0.6, durationMs: 150, fadeOutMs: 200 },
  },
  { id: "c_07", at: 31000, type: "torch", params: { on: true, durationMs: 120, strength: 1.0 } },
];

describe("PCF cue list", () => {
  test("accepts the PRD sample", () => {
    const r = validateCues(sample);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test("applies defaults", () => {
    const r = validateCues([{ id: "c_aa", at: 0, type: "brightness", params: { level: 0.5 } }]);
    expect(r.ok).toBe(true);
    expect(r.data[0].params.rampMs).toBe(0);
  });

  test("rejects duplicate ids with cue-scoped error", () => {
    const r = validateCues([sample[0], { ...sample[1], id: "c_01" }]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({
      cueId: "c_01",
      message: expect.stringContaining("duplicate"),
    });
  });

  test("rejects unsorted cues", () => {
    const r = validateCues([sample[1], sample[0]]);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain("sorted");
  });

  test("rejects waveform length mismatch", () => {
    const r = validateCue({
      id: "c_x1",
      at: 0,
      type: "vibrate",
      params: { mode: "waveform", timings: [0, 1], amplitudes: [1] },
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toBe("params.amplitudes");
  });

  test("rejects unknown type / bad color / out-of-range level", () => {
    expect(validateCue({ id: "c_x1", at: 0, type: "laser", params: {} }).ok).toBe(false);
    expect(
      validateCue({ id: "c_x1", at: 0, type: "flash", params: { color: "red", durationMs: 100 } })
        .ok,
    ).toBe(false);
    expect(validateCue({ id: "c_x1", at: 0, type: "volume", params: { level: 1.5 } }).ok).toBe(
      false,
    );
  });
});

describe("PCF document", () => {
  const doc = {
    version: 1,
    video: { provider: "youtube", id: "dQw4w9WgXcQ", title: "T", channel: "C", durationMs: 40000 },
    meta: { sheetVersion: 1, createdAt: "2026-09-11T00:00:00Z" },
    cues: sample,
  };
  test("valid + defaults injected", () => {
    const r = validateDocument(doc);
    expect(r.ok).toBe(true);
    expect(r.data.defaults).toEqual(DEFAULTS);
  });
  test("cue beyond duration is rejected with cueId", () => {
    const r = validateDocument({ ...doc, video: { ...doc.video, durationMs: 20000 } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.cueId === "c_05" && e.message.includes("duration"))).toBe(true);
  });
  test("wrong version is rejected", () => {
    expect(validateDocument({ ...doc, version: 2 }).ok).toBe(false);
  });
});

describe("helpers", () => {
  test("sortCues is stable and non-mutating", () => {
    const input = [sample[2], sample[0], sample[1]];
    const out = sortCues(input);
    expect(out.map((c) => c.id)).toEqual(["c_01", "c_02", "c_03"]);
    expect(input[0].id).toBe("c_03");
  });
  test("newCueId matches the id pattern and is unique", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newCueId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^c_[a-z0-9]{6}$/);
  });
  test("cueSheetInputSchema fills meta/defaults", () => {
    const r = cueSheetInputSchema.parse({ cues: sample });
    expect(r.defaults.toleranceMs).toBe(120);
    expect(r.meta).toEqual({});
  });
});
