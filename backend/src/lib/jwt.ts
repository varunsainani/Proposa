import crypto from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { CookieOptions } from "express";
import { env } from "./env";
import { prisma } from "./prisma";

/**
 * Auth tokens (SPEC §3).
 * - Access: JWT, 15m, Authorization: Bearer.
 * - Refresh: random 40-byte hex, sha256-hashed in DB, 30d, rotated on refresh,
 *   delivered via httpOnly cookie `proposa_refresh`.
 */

export const REFRESH_COOKIE = "proposa_refresh";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

export type AccessPayload = {
  id: string;
  role: "USER" | "ADMIN";
  email: string;
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload &
    Partial<AccessPayload>;
  if (!decoded.id || !decoded.role || !decoded.email) {
    throw new Error("Malformed access token payload");
  }
  return { id: decoded.id, role: decoded.role, email: decoded.email };
}

function hashRefresh(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a fresh refresh token for a user: returns the raw token (to set in the
 * cookie) and persists only its sha256 hash with a 30d expiry.
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashRefresh(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return raw;
}

/**
 * Validate a raw refresh token. Returns the owning userId if the token exists
 * and is unexpired; null otherwise. Expired/unknown tokens are not trusted.
 */
export async function verifyRefreshToken(
  raw: string
): Promise<{ id: string; userId: string } | null> {
  if (!raw) return null;
  const tokenHash = hashRefresh(raw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.expiresAt.getTime() <= Date.now()) {
    // Clean up the expired token.
    await prisma.refreshToken
      .delete({ where: { id: record.id } })
      .catch(() => undefined);
    return null;
  }
  return { id: record.id, userId: record.userId };
}

/** Revoke a single refresh token by its raw value (no-op if absent). */
export async function revokeRefreshToken(raw: string): Promise<void> {
  if (!raw) return;
  const tokenHash = hashRefresh(raw);
  await prisma.refreshToken
    .deleteMany({ where: { tokenHash } })
    .catch(() => undefined);
}

/** Revoke a refresh token by its DB id (used during rotation). */
export async function revokeRefreshTokenById(id: string): Promise<void> {
  await prisma.refreshToken
    .delete({ where: { id } })
    .catch(() => undefined);
}

/**
 * Rotate: revoke the presented token and issue a new one for the same user.
 * Returns the new raw refresh token.
 */
export async function rotateRefreshToken(
  oldId: string,
  userId: string
): Promise<string> {
  await revokeRefreshTokenById(oldId);
  return issueRefreshToken(userId);
}

/** Cookie options for the `proposa_refresh` cookie. */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: REFRESH_TTL_MS,
  };
}

/** Cookie options for clearing the refresh cookie (must match path/flags). */
export function clearRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
  };
}
