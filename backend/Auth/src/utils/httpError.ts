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
  return sendError(reply, fallbackMessage, fallbackStatus);
}

export function clientErrorMessage(error: unknown, fallbackMessage: string): string {
  return isHttpError(error) ? error.message : fallbackMessage;
}
