import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  FileSearch,
  BookOpen,
  PenLine,
  MessagesSquare,
  Target,
  Coins,
  Database,
} from "lucide-react";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  return (
    <div className="bg-paper min-h-screen text-fg">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] font-serif text-lg text-white">
            P
          </span>
          <span className="font-serif text-xl tracking-tight">{tc("appName")}</span>
        </span>
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="ml-1 hidden h-9 items-center rounded-md px-3 text-sm font-medium text-muted hover:text-fg sm:inline-flex focus-ring"
          >
            {t("navSignIn")}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-white hover:bg-[var(--primary-strong)] focus-ring"
          >
            {t("navTryDemo")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-10 pb-6 sm:px-8 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          {t("heroEyebrow")}
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          {t("heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--primary)] px-6 text-base font-medium text-white hover:bg-[var(--primary-strong)] focus-ring"
          >
            {t("heroCtaPrimary")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-md border border-[var(--border)] bg-surface px-6 text-base font-medium text-fg hover:bg-[var(--surface-hover)] focus-ring"
          >
            {t("heroCtaSecondary")}
          </a>
        </div>
      </section>

      {/* Before / after */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-16 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            {t("beforeAfterTitle")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t("beforeAfterSubtitle")}</p>
        </div>

        <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1.15fr]">
          {/* BEFORE: matched data */}
          <div className="rounded-lg border border-[var(--border)] bg-surface-2 p-5">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
              <Database className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
              {t("beforeLabel")}
            </p>
            <div className="rounded-md border border-[var(--border)] bg-surface p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                {t("beforeRequestLabel")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fg">{t("beforeRequest")}</p>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <ProofRow icon={Target} label={t("beforeBudget")} value="R$ 25.000,00" />
              <ProofRow icon={Target} label={t("beforeTimeline")} value={t("beforeTimelineValue")} />
              <div>
                <dt className="text-xs text-faint">{t("beforeKeywords")}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    t("beforeKeyword1"),
                    t("beforeKeyword2"),
                    t("beforeKeyword3"),
                    t("beforeKeyword4"),
                  ].map((kw) => (
                    <span
                      key={kw}
                      className="rounded border border-[var(--border)] bg-surface px-1.5 py-0.5 text-xs text-muted"
                    >
                      {kw}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">{t("beforeMatched")}</dt>
                <dd className="mt-1.5 space-y-1">
                  {[
                    [t("beforeMatched1"), 0.92],
                    [t("beforeMatched2"), 0.81],
                    [t("beforeMatched3"), 0.74],
                  ].map(([name, score]) => (
                    <div
                      key={name as string}
                      className="flex items-center gap-2 rounded border border-[var(--border)] bg-surface px-2 py-1.5"
                    >
                      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                        <span
                          className="block h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${(score as number) * 100}%` }}
                        />
                      </span>
                      <span className="flex-1 truncate text-xs text-fg">{name}</span>
                      <span className="tabular text-xs font-medium text-[var(--primary)]">
                        {Math.round((score as number) * 100)}%
                      </span>
                    </div>
                  ))}
                </dd>
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--border)] pt-2.5 text-xs text-muted">
                <Coins className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                <span className="font-semibold uppercase tracking-wide text-faint">
                  {t("beforeFx")}:
                </span>
                <span className="tabular">1 USD = 5.42 BRL</span>
              </div>
            </dl>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-[var(--primary)] lg:rotate-0">
              <ArrowRight className="h-5 w-5 max-lg:rotate-90" aria-hidden />
            </div>
          </div>

          {/* AFTER: proposal */}
          <div className="doc rounded-lg border border-[var(--border)]">
            <div className="border-b-2 border-[var(--text)] px-6 pt-6 pb-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-faint">
                {t("afterLabel")}
              </p>
              <h3 className="mt-1 font-serif text-xl leading-tight">
                {t("afterHeading")}
              </h3>
            </div>
            <div className="space-y-4 px-6 py-5 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                  {t("afterScope")}
                </p>
                <p className="mt-1 leading-relaxed text-muted">{t("afterScopeText")}</p>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                  {t("afterItemsLabel")}
                </p>
                <div className="space-y-1.5">
                  {[
                    [t("afterItem1"), "R$ 16.260,00"],
                    [t("afterItem2"), "R$ 4.336,00"],
                    [t("afterItem3"), "R$ 3.794,00"],
                  ].map(([name, amt]) => (
                    <div
                      key={name}
                      className="flex items-baseline justify-between border-b border-[var(--border-soft)] pb-1.5 last:border-0"
                    >
                      <span className="text-fg">{name}</span>
                      <span className="tabular text-muted">{amt}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="doc-rule flex items-center justify-between pt-3">
                <span className="font-serif text-base">{t("afterTotal")}</span>
                <span className="tabular font-serif text-lg font-semibold">R$ 24.390,00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("featuresTitle")}</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
          <Feature icon={FileSearch} title={t("feature1Title")} body={t("feature1Body")} />
          <Feature icon={BookOpen} title={t("feature2Title")} body={t("feature2Body")} />
          <Feature icon={PenLine} title={t("feature3Title")} body={t("feature3Body")} />
          <Feature icon={MessagesSquare} title={t("feature4Title")} body={t("feature4Body")} />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="rounded-xl border border-[var(--border)] bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="mx-auto max-w-xl font-serif text-3xl tracking-tight sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted">{t("ctaBody")}</p>
          <Link
            href="/login"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-[var(--primary)] px-7 text-base font-medium text-white hover:bg-[var(--primary-strong)] focus-ring"
          >
            {t("ctaButton")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-faint sm:flex-row sm:px-8">
          <span className="flex items-center gap-2">
            <span className="font-serif text-base text-muted">{tc("appName")}</span>
          </span>
          <span>
            © {new Date().getFullYear()} {tc("appName")}. {t("footerRights")}
          </span>
        </div>
      </footer>
    </div>
  );
}

function ProofRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1.5 text-xs text-faint">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="tabular text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileSearch;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-surface p-7">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-50 text-ink-700">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-4 font-serif text-xl">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{body}</p>
    </div>
  );
}
