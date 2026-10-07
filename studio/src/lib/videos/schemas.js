// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Request schemas for the creator API (PRD §10.1).
import { z } from "zod";

const durationMs = z
  .number()
  .int()
  .positive()
  .max(24 * 60 * 60 * 1000);
const youtubeUrl = z.string().trim().min(1).max(500);

export const createVideoSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    source: z.enum(["local", "youtube"]),
    youtubeUrl: youtubeUrl.optional(),
    localFileName: z.string().trim().max(255).optional(),
    durationMs: durationMs.optional(),
  })
  .refine((v) => v.source !== "youtube" || v.youtubeUrl, {
    message: "youtubeUrl is required when source is youtube",
    path: ["youtubeUrl"],
  });

export const updateVideoSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    youtubeUrl: youtubeUrl.optional(),
    localFileName: z.string().trim().max(255).nullable().optional(),
    durationMs: durationMs.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" });

export const publishSchema = z.object({ sheetVersion: z.number().int().positive().optional() });

export const metadataRequestSchema = z.object({
  youtubeUrl,
  durationMs: durationMs.optional(),
});

export const cueSheetQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});
