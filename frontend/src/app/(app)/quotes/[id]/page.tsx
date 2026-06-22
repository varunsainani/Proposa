"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Download, Printer, Sparkles, Database } from "lucide-react";
import { api } from "@/lib/api";
import { ApiError, type Quote } from "@/lib/types";
import {
  Button,
  EmptyState,
  Skeleton,
  useToast,
} from "@/components/ui";
import { ProposalDocument, MatchedDataPanel } from "@/components/proposal/proposal-document";

export default function QuoteViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("quoteView");
  const tp = useTranslations("proposal");
  const tc = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [downloading, setDownloading] = useState(false);
  const [showMatched, setShowMatched] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const q = await api.get<Quote>(`/quotes/${id}`);
      setQuote(q);
      setStatus("ready");
    } catch (e) {
      setStatus(e instanceof ApiError && e.status === 404 ? "notfound" : "error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await api.get<Response>(`/quotes/${id}/pdf`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (quote?.title || "proposal").replace(/[^\w\d-]+/g, "-").toLowerCase();
      a.download = `${safe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <EmptyState
        title={t("notFound")}
        action={
          <Link href="/quotes">
            <Button variant="outline">{t("back")}</Button>
          </Link>
        }
      />
    );
  }

  if (status === "error" || !quote) {
    return (
      <EmptyState
        title={t("loadFailed")}
        action={
          <Button variant="outline" onClick={() => void load()}>
            {tc("retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar (not printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowMatched((v) => !v)}>
            <Database className="h-4 w-4" aria-hidden />
            {tp("matchedData")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            {t("print")}
          </Button>
          <Link href={`/studio?quote=${quote.id}`}>
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t("refineInStudio")}
            </Button>
          </Link>
          <Button size="sm" onClick={downloadPdf} loading={downloading}>
            <Download className="h-4 w-4" aria-hidden />
            {downloading ? t("downloading") : t("downloadPdf")}
          </Button>
        </div>
      </div>

      {showMatched && (
        <div className="no-print">
          <MatchedDataPanel matched={quote.data.matchedInputs} locale={locale} />
        </div>
      )}

      <ProposalDocument quote={quote} />
    </div>
  );
}
