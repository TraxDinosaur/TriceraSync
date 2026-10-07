// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { normalize } from "../matching/normalize.js";
import vectors from "../../../../pcf/normalize-vectors.json";

describe("normalize", () => {
  for (const v of vectors.vectors) {
    test(JSON.stringify(v.in), () => {
      expect(normalize(v.in)).toBe(v.out);
    });
  }
  test("null / undefined → empty", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
  });
  test("idempotent", () => {
    for (const v of vectors.vectors) expect(normalize(v.out)).toBe(v.out);
  });
});
