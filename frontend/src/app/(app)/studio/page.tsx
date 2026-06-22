"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PencilRuler } from "lucide-react";
import { api } from "@/lib/api";
import { ApiError, type Quote } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { RequestForm, type GenerateValues } from "@/components/studio/request-form";
import { ResultView } from "@/components/studio/result-view";

export default function StudioPage() {
  // useSearchParams must be inside a Suspense boundary for prerendering.
  return (
    <Suspense fallback={<StudioFallback />}>
      <StudioInner />
    </Suspense>
  );
}

function StudioFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

function StudioInner() {
  const t = useTranslations("studio");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quote");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Remember the last request so Regenerate can re-run with the same inputs.
  const [lastRequest, setLastRequest] = useState<GenerateValues | null>(null);

  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load an existing quote when ?quote=ID is present (refinement mode).
  const loadQuote = useCallback(
    async (id: string) => {
      setLoadingQuote(true);
      setLoadError(false);
      try {
        const q = await api.get<Quote>(`/quotes/${id}`);
        setQuote(q);
        setLastRequest({
          requestText: q.requestText,
          language: q.language,
          currency: q.currency,
        });
      } catch {
        setLoadError(true);
        toast.error(t("loadFailed"));
      } finally {
        setLoadingQuote(false);
      }
    },
    [t, toast],
  );

  useEffect(() => {
    if (quoteId) {
      void loadQuote(quoteId);
    } else {
      setQuote(null);
      setLastRequest(null);
      setLoadError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  function handleApiError(e: unknown, fallbackKey: "generateFailed" | "refineFailed") {
    if (e instanceof ApiError && e.code === "RATE_LIMITED") {
      toast.error(t("rateLimited"));
      return;
    }
    const msg = e instanceof ApiError && e.message ? e.message : t(fallbackKey);
    toast.error(msg);
  }

  // Push the quote id into the URL so refresh/share keeps the result.
  function syncUrl(id: string) {
    router.replace(`/studio?quote=${id}`, { scroll: false });
  }

  async function generate(values: GenerateValues) {
    setGenerating(true);
    setLastRequest(values);
    try {
      const q = await api.post<Quote>("/quotes/generate", values);
      setQuote(q);
      syncUrl(q.id);
    } catch (e) {
      handleApiError(e, "generateFailed");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    if (!lastRequest) return;
    setRegenerating(true);
    try {
      const q = await api.post<Quote>("/quotes/generate", lastRequest);
      setQuote(q);
      syncUrl(q.id);
    } catch (e) {
      handleApiError(e, "generateFailed");
    } finally {
      setRegenerating(false);
    }
  }

  async function refine(message: string) {
    if (!quote) return;
    setRefining(true);
    try {
      const updated = await api.post<Quote>(`/quotes/${quote.id}/refine`, { message });
      setQuote(updated);
    } catch (e) {
      handleApiError(e, "refineFailed");
    } finally {
      setRefining(false);
    }
  }

  async function save() {
    if (!quote) return;
    setSaving(true);
    try {
      const updated = await api.patch<Quote>(`/quotes/${quote.id}`, { status: "FINAL" });
      setQuote(updated);
      toast.success(t("markedFinal"));
    } catch (e) {
      const msg = e instanceof ApiError && e.message ? e.message : tCommon("errorGeneric");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function newRequest() {
    setQuote(null);
    setLastRequest(null);
    setLoadError(false);
    router.replace("/studio", { scroll: false });
  }

  const showResult = quote !== null;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          showResult ? (
            <Button variant="outline" size="sm" onClick={newRequest}>
              {t("newQuote")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        {/* LEFT: request panel */}
        <div className="lg:sticky lg:top-20">
          <div className="rounded-lg border border-[var(--border)] bg-surface p-5 sm:p-6">
            <RequestForm
              defaultLanguage={locale}
              defaultCurrency={quote?.currency ?? "USD"}
              generating={generating}
              onGenerate={generate}
            />
          </div>
        </div>

        {/* RIGHT: result (proposal + chat) */}
        <div className="min-w-0">
          {loadingQuote ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-[600px] w-full" />
            </div>
          ) : loadError && !quote ? (
            <EmptyState
              icon={PencilRuler}
              title={t("loadFailed")}
              action={
                quoteId ? (
                  <Button variant="outline" onClick={() => void loadQuote(quoteId)}>
                    {tCommon("retry")}
                  </Button>
                ) : undefined
              }
            />
          ) : showResult && quote ? (
            <ResultView
              quote={quote}
              refining={refining}
              regenerating={regenerating}
              saving={saving}
              onRegenerate={regenerate}
              onSave={save}
              onRefine={refine}
              onNewRequest={newRequest}
            />
          ) : (
            <EmptyState
              icon={PencilRuler}
              title={t("emptyTitle")}
              body={t("emptyBody")}
            />
          )}
        </div>
      </div>
    </>
  );
}
