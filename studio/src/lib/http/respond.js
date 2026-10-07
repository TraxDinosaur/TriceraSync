// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "../log.js";
import { HttpError, badRequest } from "./errors.js";

export const ok = (data, init) => NextResponse.json(data, init);
export const created = (data) => NextResponse.json(data, { status: 201 });
export const noContent = () => new NextResponse(null, { status: 204 });

/** Turns any thrown value into the `{ error: { code, message, details? } }` envelope (PRD §10). */
export function fail(err) {
  if (err instanceof HttpError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details) body.error.details = err.details;
    return NextResponse.json(body, { status: err.status });
  }
  log.error({ err }, "unhandled route error");
  return NextResponse.json(
    { error: { code: "internal", message: "internal server error" } },
    { status: 500 },
  );
}

/** Wraps a route handler so thrown errors become JSON responses. */
export const route = (handler) => async (req, ctx) => {
  try {
    return await handler(req, ctx);
  } catch (err) {
    return fail(err);
  }
};

/** Parses the JSON body against a zod schema; 400 on malformed JSON, 422 on schema failure. */
export async function parseBody(req, schema) {
  let raw;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("body must be JSON");
  }
  return parseWith(schema, raw);
}

/** Parses URL search params (as a plain object) against a zod schema. */
export function parseQuery(req, schema) {
  return parseWith(schema, Object.fromEntries(new URL(req.url).searchParams));
}

function parseWith(schema, value) {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  throw new HttpError(
    422,
    "validation_failed",
    "request failed validation",
    z.treeifyError(r.error),
  );
}
