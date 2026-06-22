/**
 * Application error type + helpers (SPEC §4).
 *
 * Codes: VALIDATION UNAUTHORIZED FORBIDDEN NOT_FOUND CONFLICT RATE_LIMITED
 *        LLM_ERROR INTERNAL
 *
 * `messageKey` is an i18n key (see lib/i18n.ts) resolved at the error handler
 * using the request locale; `vars` are interpolated into the localized message.
 */

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LLM_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  messageKey: string;
  vars?: Record<string, string | number>;
  details?: unknown;

  constructor(
    status: number,
    code: ErrorCode,
    messageKey: string,
    vars?: Record<string, string | number>,
    details?: unknown
  ) {
    super(messageKey);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.vars = vars;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function badRequest(
  messageKey = "error.validation",
  vars?: Record<string, string | number>,
  details?: unknown
): AppError {
  return new AppError(400, "VALIDATION", messageKey, vars, details);
}

export function unauthorized(
  messageKey = "error.unauthorized",
  vars?: Record<string, string | number>
): AppError {
  return new AppError(401, "UNAUTHORIZED", messageKey, vars);
}

export function forbidden(
  messageKey = "error.forbidden",
  vars?: Record<string, string | number>
): AppError {
  return new AppError(403, "FORBIDDEN", messageKey, vars);
}

export function notFound(
  messageKey = "error.notFound",
  vars?: Record<string, string | number>
): AppError {
  return new AppError(404, "NOT_FOUND", messageKey, vars);
}

export function conflict(
  messageKey = "error.conflict",
  vars?: Record<string, string | number>
): AppError {
  return new AppError(409, "CONFLICT", messageKey, vars);
}

export function rateLimited(
  messageKey = "error.rateLimited",
  vars?: Record<string, string | number>
): AppError {
  return new AppError(429, "RATE_LIMITED", messageKey, vars);
}

export function llmError(
  messageKey = "error.llm",
  vars?: Record<string, string | number>,
  details?: unknown
): AppError {
  return new AppError(502, "LLM_ERROR", messageKey, vars, details);
}

export function internal(
  messageKey = "error.internal",
  vars?: Record<string, string | number>,
  details?: unknown
): AppError {
  return new AppError(500, "INTERNAL", messageKey, vars, details);
}
