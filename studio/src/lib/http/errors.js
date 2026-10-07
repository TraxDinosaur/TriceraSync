// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

/** Error carrying an HTTP status + machine-readable code. Thrown by lib code, rendered by `fail()`. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "missing or invalid x-demo-token") =>
  new HttpError(401, "unauthorized", message);
export const notFound = (what = "resource") => new HttpError(404, "not_found", `${what} not found`);
/** 404 with a verbatim message (e.g. "no TriceraSync sheet for this video"). */
export const notFoundMessage = (message) => new HttpError(404, "not_found", message);
export const conflict = (message, details) => new HttpError(409, "conflict", message, details);
export const unprocessable = (message, details) =>
  new HttpError(422, "validation_failed", message, details);
export const upstream = (message) => new HttpError(502, "upstream_error", message);

export const forbidden = (message = 'forbidden') => new HttpError(403, 'forbidden', message);

