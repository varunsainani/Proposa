"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, Loader2, MessageSquare } from "lucide-react";
import type { QuoteMessage } from "@/lib/types";
import { Button, fieldBase } from "@/components/ui";

const QUICK_KEYS = [
  "cheaper",
  "addHosting",
  "shorterTimeline",
  "rewriteEs",
  "rewriteEn",
  "rewritePt",
] as const;

export function RefineChat({
  messages,
  refining,
  onSend,
}: {
  messages: QuoteMessage[];
  refining: boolean;
  onSend: (message: string) => void;
}) {
  const t = useTranslations("studio");
  const [value, setValue] = useState("");

  function submit(text: string) {
    const msg = text.trim();
    if (!msg || refining) return;
    onSend(msg);
    setValue("");
  }

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-surface">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="flex items-center gap-2 font-serif text-base text-fg">
          <MessageSquare className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          {t("refineTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-muted">{t("refineSubtitle")}</p>
      </div>

      {/* Thread */}
      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !refining ? (
          <p className="py-6 text-center text-sm text-faint">{t("refineEmpty")}</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}
        {refining && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" aria-hidden />
            {t("refining")}
          </div>
        )}
      </div>

      {/* Quick-refine chips */}
      <div className="border-t border-[var(--border)] px-4 pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          {t("quickRefineLabel")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_KEYS.map((key) => {
            const label = t(`quickRefine.${key}`);
            return (
              <button
                key={key}
                type="button"
                disabled={refining}
                onClick={() => submit(label)}
                className="rounded-full border border-[var(--border)] bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-[var(--primary)] hover:text-fg focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <form
        className="flex items-end gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <textarea
          className={`${fieldBase} max-h-32 min-h-[40px] resize-none leading-relaxed`}
          placeholder={t("refinePlaceholder")}
          value={value}
          rows={1}
          disabled={refining}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          aria-label={t("refineTitle")}
        />
        <Button
          type="submit"
          size="md"
          loading={refining}
          disabled={value.trim().length === 0}
        >
          <Send className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("refineSend")}</span>
        </Button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: QuoteMessage }) {
  const t = useTranslations("studio");
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <span className="mb-1 text-xs font-medium text-faint">
        {isUser ? t("you") : t("assistant")}
      </span>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--primary)] text-white"
            : "border border-[var(--border)] bg-surface-2 text-fg"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
