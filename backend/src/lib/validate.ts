import { ZodError, ZodIssue, ZodSchema } from "zod";
import { badRequest } from "./errors";
import { t, Locale } from "./i18n";

/**
 * Validation helper. Parses `data` with the given zod schema; on failure throws
 * AppError(VALIDATION) carrying a localized top-level message and a `details`
 * array of { path, message } where each message is also localized.
 */

type FieldErr = { path: string; message: string };

function fieldLabel(locale: Locale, path: string): string {
  // Use the last path segment as the field key; fall back to the raw segment.
  const segs = path.split(".");
  const last = segs[segs.length - 1] || path;
  const label = t(locale, `field.${last}`);
  // If no translation exists, `t` returns the raw key "field.xxx"; strip prefix.
  return label.startsWith("field.") ? last : label;
}

function issueToMessage(locale: Locale, issue: ZodIssue): string {
  const path = issue.path.join(".");
  const field = fieldLabel(locale, path);

  switch (issue.code) {
    case "invalid_type": {
      if (issue.received === "undefined" || issue.received === "null") {
        return t(locale, "validation.required", { field });
      }
      return t(locale, "validation.invalidType", { field });
    }
    case "too_small": {
      if (issue.type === "string") {
        const min = Number(issue.minimum);
        const last = issue.path[issue.path.length - 1];
        if (last === "password") {
          return t(locale, "validation.passwordTooShort", { min });
        }
        if (min <= 1) {
          return t(locale, "validation.required", { field });
        }
        return t(locale, "validation.stringTooShort", { field, min });
      }
      return t(locale, "validation.tooSmall", { field });
    }
    case "too_big": {
      if (issue.type === "string") {
        return t(locale, "validation.stringTooLong", {
          field,
          max: Number(issue.maximum),
        });
      }
      return t(locale, "validation.tooBig", { field });
    }
    case "invalid_string": {
      if (issue.validation === "email") {
        return t(locale, "validation.invalidEmail");
      }
      return t(locale, "validation.invalidType", { field });
    }
    case "invalid_enum_value": {
      const options = (issue.options ?? []).join(", ");
      return t(locale, "validation.invalidEnum", { field, options });
    }
    case "custom": {
      // Custom refinements may stash a message key in the issue message.
      return t(locale, issue.message);
    }
    default:
      return t(locale, "validation.invalidType", { field });
  }
}

export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  locale: Locale = "en"
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const err: ZodError = result.error;
  const details: FieldErr[] = err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issueToMessage(locale, issue),
  }));

  throw badRequest("error.validation", undefined, details);
}
