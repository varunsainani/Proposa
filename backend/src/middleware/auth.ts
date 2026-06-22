import { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";

/**
 * requireAuth: validates the `Authorization: Bearer <access>` token and sets
 * req.user = { id, role, email }.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.header("Authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("auth.missingToken"));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "TokenExpiredError") {
      return next(unauthorized("auth.expiredToken"));
    }
    return next(unauthorized("auth.invalidToken"));
  }
}

/** requireAdmin: must be authenticated AND have role ADMIN. */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(unauthorized("auth.missingToken"));
  }
  if (req.user.role !== "ADMIN") {
    return next(forbidden("auth.adminRequired"));
  }
  next();
}
