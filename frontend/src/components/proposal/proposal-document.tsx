"use client";

import { useTranslations } from "next-intl";
import { Database, Target, Coins } from "lucide-react";
import type { MatchedInputs, Quote, QuoteData } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRate,
  formatScore,
} from "@/lib/format";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui";

/**
 * The rendered proposal document. Accepts either a full `Quote` or a raw
 * `QuoteData` plus meta (title/language/date) for the Studio preview before save.
 *
 * Props:
 *   - quote?: Quote                              full saved quote (preferred)
 *   - data?: QuoteData                           raw generated data (Studio)
 *   - meta?: { title; language; currency; date } meta when only `data` is given
 *   - className?: string
 */
export interface ProposalDocumentProps {
  quote?: Quote;
  data?: QuoteData;
  meta?: { title?: string; language?: string; currency?: string; date?: string };
  className?: string;
}

export function ProposalDocument({ quote, data, meta, className = "" }: ProposalDocumentProps) {
  const t = useTranslations("proposal");
  const tStatus = useTranslations("status");

  const d: QuoteData | undefined = quote?.data ?? data;
  if (!d) return null;

  const title = quote?.title ?? meta?.title ?? "";
  const language = quote?.language ?? meta?.language ?? "en";
  const currency = d.currency ?? quote?.currency ?? meta?.currency ?? "USD";
  const dateStr = quote?.createdAt ?? meta?.date ?? new Date().toISOString();
  // The document renders in the proposal's own language, not the UI locale.
  const docLocale = language;
  const money = (cents: number) => formatCurrency(cents, currency, docLocale);

  return (
    <article className={`doc rounded-lg border border-[var(--border)] ${className}`}>
      {/* Letterhead */}
      <header className="border-b-2 border-[var(--text)] px-7 pt-8 pb-6 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-faint">
              {t("documentTitle")}
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-fg sm:text-3xl">
              {title || t("documentTitle")}
            </h1>
          </div>
          {quote && (
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-muted">
              {tStatus(quote.status)}
            </span>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Meta label={t("date")} value={formatDate(dateStr, docLocale)} />
          <Meta label={t("currency")} value={currency} />
          <Meta label={t("language")} value={language.toUpperCase()} />
        </dl>
      </header>

      <div className="space-y-9 px-7 py-8 sm:px-10">
        {/* Cover note */}
        {d.coverNote && (
          <Section title={t("coverNote")}>
            <p className="whitespace-pre-line leading-relaxed text-muted">{d.coverNote}</p>
          </Section>
        )}

        {/* Scope */}
        {d.summary && (
          <Section title={t("scope")}>
            <p className="leading-relaxed text-muted">{d.summary}</p>
          </Section>
        )}

        {/* Line items */}
        <Section title={t("lineItems")}>
          {d.lineItems.length === 0 ? (
            <p className="text-sm text-faint">{t("noItems")}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("item")}</TH>
                  <TH className="text-right">{t("qty")}</TH>
                  <TH>{t("unit")}</TH>
                  <TH className="text-right">{t("unitPrice")}</TH>
                  <TH className="text-right">{t("amount")}</TH>
                </TR>
              </THead>
              <TBody>
                {d.lineItems.map((li, i) => (
                  <TR key={i}>
                    <TD>
                      <span className="font-medium text-fg">{li.name}</span>
                      {li.description && (
                        <span className="mt-0.5 block text-xs leading-snug text-muted">
                          {li.description}
                        </span>
                      )}
                    </TD>
                    <TD className="tabular text-right">{formatNumber(li.quantity, docLocale)}</TD>
                    <TD className="text-muted">{li.unit}</TD>
                    <TD className="tabular text-right">{money(li.unitPriceCents)}</TD>
                    <TD className="tabular text-right font-medium">{money(li.amountCents)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {/* Totals */}
          <div className="mt-5 flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <TotalRow label={t("subtotal")} value={money(d.subtotalCents)} />
              {d.discountCents > 0 && (
                <TotalRow label={t("discount")} value={`- ${money(d.discountCents)}`} />
              )}
              {d.taxCents > 0 && <TotalRow label={t("tax")} value={money(d.taxCents)} />}
              <div className="doc-rule mt-2 flex items-center justify-between pt-2">
                <dt className="font-serif text-base text-fg">{t("total")}</dt>
                <dd className="tabular font-serif text-lg font-semibold text-fg">
                  {money(d.totalCents)}
                </dd>
              </div>
            </dl>
          </div>
        </Section>

        {/* Timeline */}
        {d.timeline.length > 0 && (
          <Section title={t("timeline")}>
            <ol className="space-y-0">
              {d.timeline.map((ph, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--border-soft)] py-2 last:border-0"
                >
                  <span className="flex items-baseline gap-3">
                    <span className="tabular text-xs font-semibold text-[var(--primary)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-fg">{ph.phase}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">{ph.duration}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Assumptions + Terms */}
        <div className="grid gap-9 sm:grid-cols-2">
          {d.assumptions.length > 0 && (
            <Section title={t("assumptions")}>
              <BulletList items={d.assumptions} />
            </Section>
          )}
          {d.terms.length > 0 && (
            <Section title={t("terms")}>
              <BulletList items={d.terms} />
            </Section>
          )}
        </div>

        {/* Signature block */}
        <div className="doc-rule grid gap-8 pt-8 sm:grid-cols-2">
          <SignatureLine label={t("signature")} />
          <SignatureLine label={t("acceptedBy")} />
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 text-fg">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular text-fg">{value}</dd>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-muted">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-[var(--text)]" />
      <p className="mt-2 text-xs uppercase tracking-wide text-faint">{label}</p>
    </div>
  );
}

/**
 * The "before" proof: parsed constraints, ranked catalog matches with scores,
 * and the live FX line. Shown alongside the proposal to tell the before/after
 * story. Props: { matched: MatchedInputs; locale?: string }.
 */
export function MatchedDataPanel({
  matched,
  locale = "en",
  className = "",
}: {
  matched: MatchedInputs;
  locale?: string;
  className?: string;
}) {
  const t = useTranslations("proposal");
  const { constraints, rankedItems, fx } = matched;
  const sameCurrency = fx.base === fx.target;

  const budgetStr =
    constraints.budgetCents != null
      ? formatCurrency(constraints.budgetCents, fx.target ?? "USD", locale)
      : t("matchedNone");

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-surface-2 p-5 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
        <div>
          <h3 className="font-serif text-base text-fg">{t("matchedData")}</h3>
          <p className="mt-0.5 text-xs text-muted">{t("matchedIntro")}</p>
        </div>
      </div>

      {/* Constraints */}
      <div className="mb-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
          <Target className="h-3.5 w-3.5" aria-hidden />
          {t("matchedConstraints")}
        </p>
        <dl className="grid gap-2 sm:grid-cols-3">
          <Field label={t("matchedBudget")} value={budgetStr} />
          <Field
            label={t("matchedTimeline")}
            value={constraints.timelineText || t("matchedNone")}
          />
          <div>
            <dt className="text-xs text-faint">{t("matchedKeywords")}</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {constraints.keywords.length === 0 ? (
                <span className="text-sm text-fg">{t("matchedNone")}</span>
              ) : (
                constraints.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded border border-[var(--border)] bg-surface px-1.5 py-0.5 text-xs text-muted"
                  >
                    {kw}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Ranked items */}
      {rankedItems.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            {t("matchedRanked")}
          </p>
          <ul className="space-y-1.5">
            {rankedItems.map((item) => (
              <li
                key={item.catalogItemId}
                className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-surface px-3 py-2"
              >
                <ScoreBar score={item.score} />
                <span className="flex-1 truncate text-sm text-fg">{item.name}</span>
                <span className="tabular shrink-0 text-xs text-muted">
                  {formatCurrency(item.unitPriceCents, fx.target ?? "USD", locale)}
                </span>
                <span className="tabular w-10 shrink-0 text-right text-xs font-medium text-[var(--primary)]">
                  {formatScore(item.score, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FX */}
      <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-muted">
        <Coins className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
        <span className="font-semibold uppercase tracking-wide text-faint">{t("matchedFx")}:</span>
        {sameCurrency ? (
          <span>{t("matchedFxSame", { currency: fx.target })}</span>
        ) : (
          <span className="tabular">
            {t("matchedFxLine", {
              base: fx.base,
              rate: formatRate(fx.rate, locale),
              target: fx.target,
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return (
    <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--surface-hover)]" aria-hidden>
      <span
        className="block h-full rounded-full bg-[var(--primary)]"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
