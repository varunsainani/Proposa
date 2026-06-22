"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { ApiError, type QuoteListItem } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@/components/ui";

export default function QuotesPage() {
  const t = useTranslations("quotes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [quotes, setQuotes] = useState<QuoteListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState<QuoteListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const list = await api.get<QuoteListItem[]>("/quotes");
      setQuotes(list);
    } catch {
      setError(true);
      setQuotes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await api.del(`/quotes/${target.id}`);
      setQuotes((prev) => (prev ? prev.filter((q) => q.id !== target.id) : prev));
      toast.success(t("deleted"));
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError && e.message ? e.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Button onClick={() => router.push("/studio")}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("newQuote")}
          </Button>
        }
      />

      {quotes === null ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : error ? (
        <EmptyState
          icon={FileText}
          title={t("loadFailed")}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Link href="/studio">
              <Button>{t("emptyCta")}</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>{t("colTitle")}</TH>
                <TH>{t("colLanguage")}</TH>
                <TH className="text-right">{t("colTotal")}</TH>
                <TH>{t("colStatus")}</TH>
                <TH>{t("colDate")}</TH>
                <TH className="text-right" />
              </TR>
            </THead>
            <TBody>
              {quotes.map((q) => (
                <TR key={q.id} className="group">
                  <TD>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="font-medium text-fg hover:text-[var(--primary)] focus-ring"
                    >
                      {q.title}
                    </Link>
                  </TD>
                  <TD className="uppercase text-muted">{q.language}</TD>
                  <TD className="tabular text-right font-medium">
                    {formatCurrency(q.totalCents, q.currency, locale)}
                  </TD>
                  <TD>
                    <StatusBadge status={q.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted">
                    {formatDate(q.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    <button
                      onClick={() => setTarget(q)}
                      className="rounded-md p-1.5 text-faint hover:bg-[var(--surface-hover)] hover:text-[var(--err)] focus-ring"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        open={target !== null}
        onClose={() => (deleting ? null : setTarget(null))}
        onConfirm={confirmDelete}
        title={t("deleteTitle")}
        body={t("deleteBody", { title: target?.title ?? "" })}
        confirmLabel={t("deleteConfirm")}
        danger
        loading={deleting}
      />
    </>
  );
}
