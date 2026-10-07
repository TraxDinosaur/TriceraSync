// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { isoDurationToMs } from "../youtube/isoDuration.js";

describe("isoDurationToMs", () => {
  test.each([
    ["PT0S", 0],
    ["PT15S", 15_000],
    ["PT1M", 60_000],
    ["PT1M30S", 90_000],
    ["PT1H2M3S", 3_723_000],
    ["PT10H", 36_000_000],
    ["P1DT1H", 90_000_000],
    ["PT2.5S", 2_500],
  ])("%s → %i", (iso, ms) => expect(isoDurationToMs(iso)).toBe(ms));

  test.each(["", "P", "PT", "1:02:03", "PT1X", null, 12])("rejects %p", (v) =>
    expect(isoDurationToMs(v)).toBeNull(),
  );
});
