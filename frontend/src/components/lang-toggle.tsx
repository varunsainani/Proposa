"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";

export function LangToggle() {
  const locale = useLocale();
  const t = useTranslations("lang");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(next: Locale) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-surface px-2.5 text-sm text-fg hover:bg-[var(--surface-hover)] focus-ring"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4 text-faint" aria-hidden />
        <span className="uppercase">{locale}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-md border border-[var(--border)] bg-surface py-1 shadow-lg"
        >
          {locales.map((l) => (
            <button
              key={l}
              role="menuitem"
              onClick={() => choose(l)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-fg hover:bg-[var(--surface-hover)]"
            >
              {t(l)}
              {l === locale && <Check className="h-4 w-4 text-[var(--primary)]" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
