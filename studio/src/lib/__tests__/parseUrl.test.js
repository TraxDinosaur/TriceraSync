// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { describe, expect, test } from "bun:test";
import { parseYouTubeVideoId } from "../youtube/parseUrl.js";

const ID = "dQw4w9WgXcQ";
const good = [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
  `https://m.youtube.com/watch?feature=share&v=${ID}`,
  `https://youtu.be/${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}?autoplay=1`,
  `https://www.youtube.com/live/${ID}`,
  `https://www.youtube-nocookie.com/embed/${ID}`,
  `youtube.com/watch?v=${ID}`,
  `  https://youtu.be/${ID}  `,
  ID,
];
const bad = [
  "https://vimeo.com/123456",
  "https://www.youtube.com/",
  "https://www.youtube.com/channel/UC123",
  "https://www.youtube.com/watch?v=tooShort",
  "https://evil.com/watch?v=dQw4w9WgXcQ",
  "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
  "not a url",
  "",
  null,
  42,
];

describe("parseYouTubeVideoId", () => {
  for (const u of good) test(`accepts ${u}`, () => expect(parseYouTubeVideoId(u)).toBe(ID));
  for (const u of bad)
    test(`rejects ${String(u)}`, () => expect(parseYouTubeVideoId(u)).toBeNull());
});
