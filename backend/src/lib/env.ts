import "dotenv/config";

/**
 * Typed environment loader for the Proposa backend.
 * Exposes all variables from SPEC §10.
 *
 * Production fail-fast: throws if JWT secrets, GEMINI_API_KEY (when LLM_PROVIDER=gemini),
 * or PY_SHARED_SECRET are missing. CORS is non-fatal: warns and falls back to APP_URL,
 * never "*".
 */

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const NODE_ENV = str("NODE_ENV", "development");
const isProd = NODE_ENV === "production";

const LLM_PROVIDER = (str("LLM_PROVIDER", "gemini").toLowerCase() === "anthropic"
  ? "anthropic"
  : "gemini") as "gemini" | "anthropic";

const APP_URL = str("APP_URL", "http://localhost:3000");

// CORS: non-fatal. Fall back to APP_URL, never "*".
let corsOrigin = str("CORS_ORIGIN");
if (!corsOrigin) {
  if (isProd) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] CORS_ORIGIN not set; falling back to APP_URL (${APP_URL}).`
    );
  }
  corsOrigin = APP_URL;
} else if (corsOrigin === "*") {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] CORS_ORIGIN="*" is not allowed with credentials; falling back to APP_URL (${APP_URL}).`
  );
  corsOrigin = APP_URL;
}

// Support comma-separated list of allowed origins.
const CORS_ORIGIN: string | string[] = corsOrigin.includes(",")
  ? corsOrigin
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : corsOrigin;

export const env = {
  NODE_ENV,
  isProd,
  PORT: int("PORT", 4000),

  DATABASE_URL: str("DATABASE_URL"),
  DIRECT_URL: str("DIRECT_URL"),

  JWT_ACCESS_SECRET: str("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: str("JWT_REFRESH_SECRET"),

  LLM_PROVIDER,
  GEMINI_API_KEY: str("GEMINI_API_KEY"),
  GEMINI_MODEL: str("GEMINI_MODEL", "gemini-flash-latest"),
  ANTHROPIC_API_KEY: str("ANTHROPIC_API_KEY"),
  ANTHROPIC_MODEL: str("ANTHROPIC_MODEL", "claude-sonnet-4-6"),

  PY_SERVICE_URL: str("PY_SERVICE_URL", "http://localhost:8000"),
  PY_SHARED_SECRET: str("PY_SHARED_SECRET"),

  APP_URL,
  CORS_ORIGIN,

  GEN_DAILY_CAP: int("GEN_DAILY_CAP", 40),
} as const;

// Production fail-fast checks.
if (env.isProd) {
  const missing: string[] = [];
  if (!env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (env.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY)
    missing.push("GEMINI_API_KEY");
  if (!env.PY_SHARED_SECRET) missing.push("PY_SHARED_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables in production: ${missing.join(
        ", "
      )}`
    );
  }
} else {
  // Dev-friendly defaults so the app can boot without a full .env.
  if (!env.JWT_ACCESS_SECRET)
    (env as { JWT_ACCESS_SECRET: string }).JWT_ACCESS_SECRET =
      "dev-access-secret-change-me";
  if (!env.JWT_REFRESH_SECRET)
    (env as { JWT_REFRESH_SECRET: string }).JWT_REFRESH_SECRET =
      "dev-refresh-secret-change-me";
}

export type Env = typeof env;
