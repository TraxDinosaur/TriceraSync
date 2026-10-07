import { cueListSchema, cueSchema, pcfDocumentSchema } from "./schema.js";

/**
 * Shapes zod issues into `{ cueId?, path, message }` so the inspector can show
 * inline errors per cue (FR-14).
 */
function toErrors(issues, cues) {
  return issues.map((issue) => {
    const [head, ...rest] = issue.path;
    const idx = head === "cues" ? rest[0] : head;
    const cueId = typeof idx === "number" ? cues?.[idx]?.id : undefined;
    return { cueId, path: issue.path.join("."), message: issue.message };
  });
}

/** Validates a cue list (the editor's working set). Returns `{ ok, data?, errors }`. */
export function validateCues(cues) {
  const r = cueListSchema.safeParse(cues);
  return r.success
    ? { ok: true, data: r.data, errors: [] }
    : { ok: false, errors: toErrors(r.error.issues, cues) };
}

/** Validates a single cue (used live in the inspector). */
export function validateCue(cue) {
  const r = cueSchema.safeParse(cue);
  return r.success
    ? { ok: true, data: r.data, errors: [] }
    : { ok: false, errors: toErrors(r.error.issues) };
}

/** Validates a full PCF document (what the resolve API emits / the Engine consumes). */
export function validateDocument(doc) {
  const r = pcfDocumentSchema.safeParse(doc);
  return r.success
    ? { ok: true, data: r.data, errors: [] }
    : { ok: false, errors: toErrors(r.error.issues, doc?.cues) };
}
