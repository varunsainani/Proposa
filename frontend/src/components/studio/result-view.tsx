"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle2,
  FilePlus2,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Quote } from "@/lib/types";
import { Button, StatusBadge, useToast } from "@/components/ui";
import { ProposalDocument, MatchedDataPanel } from "@/components/proposal/proposal-document";
import { RefineChat } from "./refine-chat";

export function ResultView({
  quote,
  refining,
  regenerating,
  saving,
  onRegenerate,
  onSave,
  onRefine,
  onNewRequest,
}: {
  quote: Quote;
  refining: boolean;
  regenerating: boolean;
  saving: boolean;
  onRegenerate: () => void;
  onSave: () => void;
  onRefine: (message: string) => void;
  onNewRequest: () => void;
}) {
  const t = useTranslations("studio");
  const tQuoteView = useTranslations("quoteView");
  const locale = useLocale();
  const toast = useToast();

  const [showMatched, setShowMatched] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isFinal = quote.status === "FINAL";

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await api.get<Response>(`/quotes/${quote.id}/pdf`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (quote.title || "proposal").replace(/[^\w\d-]+/g, "-").toLowerCase();
      a.download = `${safe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(tQuoteView("downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={quote.status} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewRequest}
            disabled={regenerating || refining}
          >
            <FilePlus2 className="h-4 w-4" aria-hidden />
            {t("newRequest")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            loading={regenerating}
            disabled={refining}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("regenerate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            loading={saving}
            disabled={isFinal || regenerating || refining}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {isFinal ? t("markedFinal") : t("saveFinal")}
          </Button>
          <Button
            size="sm"
            onClick={downloadPdf}
            loading={downloading}
            disabled={regenerating || refining}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("downloadPdf")}
          </Button>
        </div>
      </div>

      {/* Matched data (collapsible) - the before/after proof */}
      <div className="no-print">
        <button
          type="button"
          onClick={() => setShowMatched((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-surface-2 px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-[var(--surface-hover)] focus-ring"
          aria-expanded={showMatched}
        >
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--primary)]" aria-hidden />
            {showMatched ? t("matchedHide") : t("matchedShow")}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-faint transition-transform ${showMatched ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {showMatched && (
          <div className="mt-3">
            <MatchedDataPanel matched={quote.data.matchedInputs} locale={locale} />
          </div>
        )}
      </div>

      {/* The proposal document (renders in the quote's own language) */}
      <ProposalDocument quote={quote} />

      {/* Refine chat */}
      <div className="no-print">
        <RefineChat messages={quote.messages} refining={refining} onSend={onRefine} />
      </div>
    </div>
  );
}
