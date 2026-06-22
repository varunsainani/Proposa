import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, isAppError } from "../lib/errors";
import { t, Locale } from "../lib/i18n";

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const locale = (req.locale ?? "en") as Locale;
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: t(locale, "error.notFound"),
    },
  });
}

type BodyParserError = Error & {
  type?: string;
  status?: number;
  statusCode?: number;
};

function isBodyParserJsonError(e: unknown): e is BodyParserError {
  const err = e as BodyParserError;
  return (
    !!err &&
    typeof err === "object" &&
    (err.type === "entity.parse.failed" ||
      (err instanceof SyntaxError && "body" in err))
  );
}

function isPayloadTooLarge(e: unknown): e is BodyParserError {
  const err = e as BodyParserError;
  return !!err && typeof err === "object" && err.type === "entity.too.large";
}

/**
 * Central error handler -> { error: { code, message, details? } }, localized.
 * Maps AppError + zod + body-parser + unknown -> INTERNAL(500).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const locale = (req.locale ?? "en") as Locale;

  // Our own application errors.
  if (isAppError(err)) {
    const e = err as AppError;
    const body: {
      error: { code: string; message: string; details?: unknown };
    } = {
      error: {
        code: e.code,
        message: t(locale, e.messageKey, e.vars),
      },
    };
    if (e.details !== undefined) body.error.details = e.details;
    res.status(e.status).json(body);
    return;
  }

  // Zod errors that escaped the validate() helper.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: t(locale, "error.validation"),
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
    return;
  }

  // express.json() malformed-body errors.
  if (isBodyParserJsonError(err)) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: t(locale, "error.invalidJson"),
      },
    });
    return;
  }

  if (isPayloadTooLarge(err)) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: t(locale, "error.validation"),
      },
    });
    return;
  }

  // Unknown -> INTERNAL(500). Log server-side for diagnosis.
  // eslint-disable-next-line no-console
  console.error("[error] unhandled:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: t(locale, "error.internal"),
    },
  });
}
