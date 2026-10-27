import type { FastifyReply } from "fastify";
import { sendError } from "./respond.js";

// An expected, client-facing failure (validation, permissions, not found).
// Its message is safe to send back; anything else is treated as internal.
export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

// A write pointing at a row that does not exist (unknown user, group, ...)
// is the client's mistake, not a server failure.
export function isForeignKeyViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === "SQLITE_CONSTRAINT" && /FOREIGN KEY/i.test(String(err.message));
}

// Replies with the error's own message and status when it is an HttpError,
// otherwise with a generic message so DB/system details never leak.
export function sendCaughtError(
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
) {
  if (isHttpError(error)) {
    return sendError(reply, error.message, error.statusCode);
  }
  if (isForeignKeyViolation(error)) {
    return sendError(reply, "Referenced record does not exist", 400);
  }
  return sendError(reply, fallbackMessage, fallbackStatus);
}

export function clientErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isHttpError(error)) return error.message;
  if (isForeignKeyViolation(error)) return "Referenced record does not exist";
  return fallbackMessage;
}
