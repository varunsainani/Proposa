"use client";

import { useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import type { QuoteStatus } from "@/lib/types";

type Tone = "neutral" | "ink" | "amber" | "emerald" | "rose";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-[var(--border)]",
  ink: "bg-ink-50 text-ink-700 border-ink-100",
  amber: "border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]",
  emerald: "border-[color-mix(in_srgb,var(--ok)_30%,transparent)] text-[var(--ok)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]",
  rose: "border-[color-mix(in_srgb,var(--err)_30%,transparent)] text-[var(--err)] bg-[color-mix(in_srgb,var(--err)_10%,transparent)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const t = useTranslations("status");
  const tone: Tone = status === "FINAL" ? "emerald" : "amber";
  return (
    <Badge tone={tone}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
        aria-hidden
      />
      {t(status)}
    </Badge>
  );
}
