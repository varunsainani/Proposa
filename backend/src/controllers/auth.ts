import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validate } from "../lib/validate";
import { conflict, notFound, unauthorized } from "../lib/errors";
import { LOCALES } from "../lib/i18n";
import {
  REFRESH_COOKIE,
  clearRefreshCookieOptions,
  issueRefreshToken,
  refreshCookieOptions,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyRefreshToken,
} from "../lib/jwt";

const BCRYPT_ROUNDS = 10;

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  locale: string;
};

function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  locale: string;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    locale: u.locale,
  };
}

async function setSession(res: Response, userId: string): Promise<void> {
  const raw = await issueRefreshToken(userId);
  res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions());
}

// --- Schemas ---

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
  locale: z.enum(["en", "es", "pt"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const demoSchema = z.object({
  role: z.enum(["user", "admin"]),
});

const patchMeSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    locale: z.enum(["en", "es", "pt"]).optional(),
  })
  .refine((v) => v.name !== undefined || v.locale !== undefined, {
    message: "error.validation",
  });

// --- Handlers ---

export async function register(req: Request, res: Response): Promise<void> {
  const body = validate(registerSchema, req.body, req.locale);
  const email = body.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict("auth.emailTaken");
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  const locale = LOCALES.includes((body.locale ?? "en") as never)
    ? body.locale ?? req.locale
    : req.locale;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: body.name.trim(),
      locale: locale ?? "en",
      role: "USER",
    },
  });

  await setSession(res, user.id);
  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });

  res.status(201).json({ user: toPublicUser(user), accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = validate(loginSchema, req.body, req.locale);
  const email = body.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw unauthorized("auth.invalidCredentials");
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    throw unauthorized("auth.invalidCredentials");
  }

  await setSession(res, user.id);
  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });

  res.json({ user: toPublicUser(user), accessToken });
}

/**
 * One-click demo login into the seeded demo@/admin@proposa.app accounts.
 * Requires the accounts to exist (created by the seed script).
 */
export async function demo(req: Request, res: Response): Promise<void> {
  const body = validate(demoSchema, req.body, req.locale);
  const email =
    body.role === "admin" ? "admin@proposa.app" : "demo@proposa.app";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw notFound("auth.demoUnavailable");
  }

  await setSession(res, user.id);
  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });

  res.json({ user: toPublicUser(user), accessToken });
}

/**
 * Rotate the refresh cookie and mint a new access token. The presented refresh
 * token is revoked and replaced.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? "";
  const record = await verifyRefreshToken(raw);
  if (!record) {
    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    throw unauthorized("auth.refreshInvalid");
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    await revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    throw unauthorized("auth.refreshInvalid");
  }

  const newRaw = await rotateRefreshToken(record.id, user.id);
  res.cookie(REFRESH_COOKIE, newRaw, refreshCookieOptions());

  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });

  res.json({ user: toPublicUser(user), accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? "";
  if (raw) {
    await revokeRefreshToken(raw);
  }
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  // requireAuth guarantees req.user.
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });
  if (!user) {
    throw unauthorized("auth.invalidToken");
  }
  res.json({ user: toPublicUser(user) });
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  const body = validate(patchMeSchema, req.body, req.locale);

  const data: { name?: string; locale?: string } = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.locale !== undefined) data.locale = body.locale;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });

  res.json({ user: toPublicUser(user) });
}
