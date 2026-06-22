"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { Button, Select, Textarea, Skeleton } from "@/components/ui";
import { useWorkingStep } from "./use-generate";

export interface GenerateValues {
  requestText: string;
  language: string;
  currency: string;
}

const LANGUAGES = ["en", "es", "pt"] as const;
const CURRENCIES = ["USD", "BRL", "ARS", "EUR", "MXN"] as const;
const EXAMPLE_KEYS = ["marketingSite", "mobileApp", "brandIdentity"] as const;

export function RequestForm({
  defaultLanguage,
  defaultCurrency = "USD",
  generating = false,
  onGenerate,
}: {
  defaultLanguage: string;
  defaultCurrency?: string;
  generating?: boolean;
  onGenerate: (values: GenerateValues) => void;
}) {
  const t = useTranslations("studio");
  const tLang = useTranslations("lang");
  const tCurrency = useTranslations("currency");

  const [requestText, setRequestText] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [touched, setTouched] = useState(false);

  const empty = requestText.trim().length === 0;
  const showError = touched && empty;

  function submit() {
    setTouched(true);
    if (empty) return;
    onGenerate({ requestText: requestText.trim(), language, currency });
  }

  if (generating) {
    return <GeneratingState />;
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        label={t("requestLabel")}
        placeholder={t("requestPlaceholder")}
        value={requestText}
        onChange={(e) => setRequestText(e.target.value)}
        rows={7}
        error={showError ? t("requestRequired") : undefined}
      />

      {/* Example chips */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          {t("examplesLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((key) => {
            const text = t(`examples.${key}`);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRequestText(text)}
                className="rounded-full border border-[var(--border)] bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-[var(--primary)] hover:text-fg focus-ring"
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("languageLabel")}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          options={LANGUAGES.map((l) => ({ value: l, label: tLang(l) }))}
        />
        <Select
          label={t("currencyLabel")}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({
            value: c,
            label: `${c} — ${tCurrency(c)}`,
          }))}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={empty}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {t("generate")}
      </Button>
    </form>
  );
}

/** The tasteful "AI is working" state: stepper copy + a shimmering document. */
function GeneratingState() {
  const t = useTranslations("studio");
  const step = useWorkingStep(true);
  const steps = ["gather", "match", "write"] as const;

  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" aria-hidden />
          <p className="font-serif text-lg text-fg">{t("generating")}</p>
        </div>
        <p className="mt-1 text-sm text-muted">{t("generatingHint")}</p>
      </div>

      {/* Pipeline steps */}
      <ol className="space-y-2">
        {steps.map((key, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  done
                    ? "border-[var(--ok)] bg-[var(--ok)] text-white"
                    : active
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-[var(--border)] text-faint"
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span className={active || done ? "text-fg" : "text-faint"}>
                {t(`steps.${key}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Shimmering proposal skeleton */}
      <div className="rounded-lg border border-[var(--border)] bg-surface p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-3 h-3 w-1/3" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
    </div>
  );
}
