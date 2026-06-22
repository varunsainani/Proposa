import { NextFunction, Request, Response } from "express";
import { isLocale, Locale } from "../lib/i18n";

/**
 * Resolves req.locale from the `X-Locale` header (en|es|pt), else the first
 * matching language in `Accept-Language`, else "en".
 *
 * Mount BEFORE express.json() so localized body-parse errors are possible.
 */
function fromAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  // e.g. "es-ES,es;q=0.9,en;q=0.8"
  const parts = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export function locale(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("X-Locale");
  if (header && isLocale(header.toLowerCase())) {
    req.locale = header.toLowerCase() as Locale;
    return next();
  }

  req.locale = fromAcceptLanguage(req.header("Accept-Language")) ?? "en";
  next();
}
