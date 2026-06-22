"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, User, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/types";
import { Button, Input } from "@/components/ui";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { login, register, demoLogin } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"user" | "admin" | null>(null);

  function messageForError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === "CONFLICT") return t("emailTaken");
      if (e.status === 401 || e.code === "UNAUTHORIZED") return t("invalidCredentials");
      if (e.message) return e.message;
    }
    return mode === "login" ? t("invalidCredentials") : t("registerFailed");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      router.replace("/studio");
    } catch (err) {
      setError(messageForError(err));
      setSubmitting(false);
    }
  }

  async function onDemo(role: "user" | "admin") {
    setError(null);
    setDemoLoading(role);
    try {
      await demoLogin(role);
      router.replace("/studio");
    } catch {
      setError(tc("errorGeneric"));
      setDemoLoading(null);
    }
  }

  const busy = submitting || demoLoading !== null;

  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("backToHome")}
        </Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2 focus-ring">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary)] font-serif text-xl text-white">
                P
              </span>
              <span className="font-serif text-2xl tracking-tight text-fg">{tc("appName")}</span>
            </Link>
          </div>

          {/* Demo card */}
          <div className="rounded-lg border border-[var(--border)] bg-surface p-5">
            <h2 className="font-serif text-lg text-fg">{t("demoTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{t("demoSubtitle")}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                variant="primary"
                onClick={() => onDemo("user")}
                loading={demoLoading === "user"}
                disabled={busy}
              >
                <User className="h-4 w-4" aria-hidden />
                {t("demoUser")}
              </Button>
              <Button
                variant="outline"
                onClick={() => onDemo("admin")}
                loading={demoLoading === "admin"}
                disabled={busy}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {t("demoAdmin")}
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-faint">{t("demoHint")}</p>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-faint">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t("orDivider")}
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          {/* Real form */}
          <div className="rounded-lg border border-[var(--border)] bg-surface p-6">
            <h1 className="font-serif text-xl text-fg">
              {mode === "login" ? t("loginTitle") : t("registerTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              {mode === "register" && (
                <Input
                  label={t("name")}
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              )}
              <Input
                type="email"
                label={t("email")}
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                type="password"
                label={t("password")}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              {error && (
                <p className="rounded-md border border-[color-mix(in_srgb,var(--err)_35%,transparent)] bg-[color-mix(in_srgb,var(--err)_8%,transparent)] px-3 py-2 text-sm text-[var(--err)]">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={submitting} disabled={busy}>
                {mode === "login" ? t("signIn") : t("signUp")}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-muted">
              {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="font-medium text-[var(--primary)] hover:underline focus-ring"
              >
                {mode === "login" ? t("switchToRegister") : t("switchToLogin")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
