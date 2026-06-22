"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Sun, Moon, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { locales, type Locale } from "@/i18n/config";
import { PageHeader } from "@/components/page-header";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@/components/ui";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tLang = useTranslations("lang");
  const tTheme = useTranslations("theme");
  const locale = useLocale();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.patch<{ user: User }>("/auth/me", { name: name.trim() });
      setUser(res.user);
      toast.success(t("profileSaved"));
    } catch {
      toast.error(t("profileFailed"));
    } finally {
      setSaving(false);
    }
  }

  function changeLanguage(next: Locale) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    // Persist preference to the account (best effort).
    void api
      .patch<{ user: User }>("/auth/me", { locale: next })
      .then((r) => setUser(r.user))
      .catch(() => {});
    router.refresh();
  }

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>{t("profileTitle")}</CardTitle>
            <CardDescription>{t("profileSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input
                label={t("name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label={t("email")}
                value={user?.email ?? ""}
                hint={t("emailReadonly")}
                readOnly
                disabled
              />
              <Button type="submit" loading={saving} disabled={!name.trim()}>
                {t("saveProfile")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t("preferencesTitle")}</CardTitle>
            <CardDescription>{t("preferencesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div>
              <p className="mb-2 text-sm font-medium text-fg">{t("language")}</p>
              <div className="flex flex-wrap gap-2">
                {locales.map((l) => {
                  const active = l === locale;
                  return (
                    <button
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm focus-ring ${
                        active
                          ? "border-[var(--primary)] bg-ink-50 text-ink-700"
                          : "border-[var(--border)] bg-surface text-fg hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" aria-hidden />}
                      {tLang(l)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme */}
            <div>
              <p className="mb-2 text-sm font-medium text-fg">{t("theme")}</p>
              <div className="flex gap-2">
                <ThemeOption
                  active={mounted && !isDark}
                  onClick={() => setTheme("light")}
                  icon={Sun}
                  label={tTheme("light")}
                />
                <ThemeOption
                  active={isDark}
                  onClick={() => setTheme("dark")}
                  icon={Moon}
                  label={tTheme("dark")}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ThemeOption({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm focus-ring ${
        active
          ? "border-[var(--primary)] bg-ink-50 text-ink-700"
          : "border-[var(--border)] bg-surface text-fg hover:bg-[var(--surface-hover)]"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
