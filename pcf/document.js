import { DEFAULTS, PCF_VERSION } from "./schema.js";

/**
 * Assembles the PCF v1 document (PRD §8) from a `videos` row and a `cue_sheets` row.
 * This is the exact shape the resolve API returns and the Engine consumes.
 */
export function buildPcfDocument(video, sheet) {
  const { defaults, ...meta } = sheet.meta ?? {};
  return {
    version: PCF_VERSION,
    video: {
      provider: "youtube",
      id: video.youtubeVideoId ?? null,
      title: video.title ?? null,
      channel: video.channelName ?? null,
      durationMs: video.durationMs ?? null,
    },
    meta: {
      sheetVersion: sheet.sheetVersion,
      createdAt: new Date(sheet.createdAt).toISOString(),
      ...(meta.fps != null && { fps: meta.fps }),
    },
    defaults: { ...DEFAULTS, ...defaults },
    cues: sheet.cues,
  };
}

/** API shape for a cue-sheet row: the PCF pieces plus identifiers. */
export function serializeCueSheet(sheet) {
  const { defaults, ...meta } = sheet.meta ?? {};
  return {
    id: sheet.id,
    videoId: sheet.videoId,
    sheetVersion: sheet.sheetVersion,
    isActive: sheet.isActive,
    createdAt: sheet.createdAt,
    cues: sheet.cues,
    meta,
    defaults: { ...DEFAULTS, ...defaults },
  };
}
