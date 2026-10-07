// TriceraSync Cue Format (PCF) v1 — single source of truth (README/PRD.md §8).
// The Android Engine mirrors this schema; bump PCF_VERSION on breaking changes.
import { z } from "zod";

export const PCF_VERSION = 1;

export const CUE_TYPES = ["vibrate", "brightness", "volume", "flash", "torch"];
export const STATE_CUE_TYPES = ["brightness", "volume", "torch"];
export const INSTANT_CUE_TYPES = ["vibrate", "flash"];
export const PREDEFINED_EFFECTS = ["CLICK", "DOUBLE_CLICK", "HEAVY_CLICK", "TICK"];

export const DEFAULTS = Object.freeze({ restoreOnEnd: true, toleranceMs: 120 });

const ms = z.number().int().nonnegative();
const unit = z.number().min(0).max(1);
const cueId = z.string().regex(/^c_[A-Za-z0-9]{2,}$/, "id must look like c_ab12");
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "color must be #RRGGBB");

const vibrateParams = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("oneShot"),
    durationMs: z.number().int().min(10).max(10_000),
    amplitude: z.number().int().min(1).max(255).default(255),
  }),
  z
    .object({
      mode: z.literal("waveform"),
      timings: z.array(z.number().int().nonnegative()).min(1).max(64),
      amplitudes: z.array(z.number().int().min(0).max(255)).min(1).max(64),
      repeat: z.number().int().min(-1).default(-1),
    })
    .refine((p) => p.timings.length === p.amplitudes.length, {
      message: "timings and amplitudes must have the same length",
      path: ["amplitudes"],
    }),
  z.object({
    mode: z.literal("predefined"),
    effect: z.enum(PREDEFINED_EFFECTS),
  }),
]);

const base = { id: cueId, at: ms, durationMs: ms.optional() };

export const cueSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("vibrate"), params: vibrateParams }),
  z.object({
    ...base,
    type: z.literal("brightness"),
    params: z.object({ level: unit, rampMs: ms.default(0) }),
  }),
  z.object({
    ...base,
    type: z.literal("volume"),
    params: z.object({ level: unit, rampMs: ms.default(0) }),
  }),
  z.object({
    ...base,
    type: z.literal("flash"),
    params: z.object({
      color: hexColor,
      opacity: unit.default(0.6),
      durationMs: z.number().int().min(16).max(5_000),
      fadeOutMs: ms.default(0),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("torch"),
    params: z.object({
      on: z.boolean(),
      durationMs: z.number().int().min(16).max(30_000).optional(),
      strength: unit.default(1),
    }),
  }),
]);

export const videoBlockSchema = z.object({
  provider: z.literal("youtube"),
  id: z.string().nullable(),
  title: z.string().nullable(),
  channel: z.string().nullable(),
  durationMs: z.number().int().positive().nullable(),
});

export const metaSchema = z.object({
  sheetVersion: z.number().int().positive(),
  createdAt: z.string(),
  fps: z.number().positive().max(240).optional(),
});

export const defaultsSchema = z.object({
  restoreOnEnd: z.boolean().default(DEFAULTS.restoreOnEnd),
  toleranceMs: z.number().int().min(0).max(2_000).default(DEFAULTS.toleranceMs),
});

/** Cue list rules that span multiple cues: unique ids, sorted by `at`, within duration. */
export function refineCues(cues, ctx, durationMs) {
  const seen = new Set();
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (seen.has(c.id)) {
      ctx.addIssue({ code: "custom", message: `duplicate cue id ${c.id}`, path: [i, "id"] });
    }
    seen.add(c.id);
    if (i > 0 && cues[i - 1].at > c.at) {
      ctx.addIssue({ code: "custom", message: "cues must be sorted by at", path: [i, "at"] });
    }
    if (durationMs != null && c.at > durationMs) {
      ctx.addIssue({ code: "custom", message: "cue is beyond video duration", path: [i, "at"] });
    }
  }
}

export const cueListSchema = z.array(cueSchema).superRefine((cues, ctx) => refineCues(cues, ctx));

/** Full PCF document as returned by the resolve API. */
export const pcfDocumentSchema = z
  .object({
    version: z.literal(PCF_VERSION),
    video: videoBlockSchema,
    meta: metaSchema,
    defaults: defaultsSchema.default(DEFAULTS),
    cues: z.array(cueSchema),
  })
  .superRefine((doc, ctx) =>
    refineCues(
      doc.cues,
      { addIssue: (i) => ctx.addIssue({ ...i, path: ["cues", ...i.path] }) },
      doc.video.durationMs,
    ),
  );

/** Body accepted by PUT /api/videos/:id/cues (server fills version/meta.sheetVersion/createdAt). */
export const cueSheetInputSchema = z.object({
  cues: cueListSchema,
  meta: z.object({ fps: metaSchema.shape.fps }).partial().default({}),
  defaults: defaultsSchema.default(DEFAULTS),
});
