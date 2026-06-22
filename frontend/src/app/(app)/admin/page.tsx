"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Users, FileText, Wallet, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminOverview, AdminUser } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

export default function AdminPage() {
  const t = useTranslations("admin");
  const tRole = useTranslations("role");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState(false);

  // Guard: non-admins are redirected.
  useEffect(() => {
    if (!authLoading && user && user.role !== "ADMIN") {
      router.replace("/studio");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const [ov, us] = await Promise.all([
          api.get<AdminOverview>("/admin/overview"),
          api.get<AdminUser[]>("/admin/users").catch(() => [] as AdminUser[]),
        ]);
        if (!cancelled) {
          setOverview(ov);
          setUsers(us);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user && user.role !== "ADMIN") {
    return <EmptyState icon={BarChart3} title={t("forbidden")} />;
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {error ? (
        <EmptyState icon={BarChart3} title={t("loadFailed")} />
      ) : overview === null ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label={t("statUsers")} value={String(overview.stats.users)} />
            <Stat icon={FileText} label={t("statQuotes")} value={String(overview.stats.quotes)} />
            <Stat
              icon={Wallet}
              label={t("statTotalValue")}
              value={formatCurrency(overview.stats.totalValueCents, "USD", locale)}
            />
            <Stat
              icon={BarChart3}
              label={t("statAvgQuote")}
              value={formatCurrency(overview.stats.avgQuoteCents, "USD", locale)}
            />
          </div>

          {/* Recent quotes */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{t("recentTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {overview.recentQuotes.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-faint">{t("emptyQuotes")}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH className="pl-5">{t("colTitle")}</TH>
                      <TH>{t("colUser")}</TH>
                      <TH className="text-right">{t("colTotal")}</TH>
                      <TH>{t("colStatus")}</TH>
                      <TH className="pr-5">{t("colDate")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {overview.recentQuotes.map((q) => (
                      <TR key={q.id}>
                        <TD className="pl-5">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="font-medium text-fg hover:text-[var(--primary)] focus-ring"
                          >
                            {q.title}
                          </Link>
                        </TD>
                        <TD>
                          <span className="block text-fg">{q.user.name}</span>
                          <span className="block text-xs text-faint">{q.user.email}</span>
                        </TD>
                        <TD className="tabular text-right">
                          {formatCurrency(q.totalCents, q.currency, locale)}
                        </TD>
                        <TD>
                          <StatusBadge status={q.status} />
                        </TD>
                        <TD className="whitespace-nowrap pr-5 text-muted">
                          {formatDate(q.createdAt, locale)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Users */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{t("usersTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {!users || users.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-faint">{t("emptyUsers")}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH className="pl-5">{t("colUser")}</TH>
                      <TH>{t("colEmail")}</TH>
                      <TH>{t("colRole")}</TH>
                      <TH className="text-right">{t("colQuotes")}</TH>
                      <TH className="pr-5">{t("colJoined")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {users.map((u) => (
                      <TR key={u.id}>
                        <TD className="pl-5 font-medium text-fg">{u.name}</TD>
                        <TD className="text-muted">{u.email}</TD>
                        <TD className="text-muted">{tRole(u.role)}</TD>
                        <TD className="tabular text-right">{u.quoteCount}</TD>
                        <TD className="whitespace-nowrap pr-5 text-muted">
                          {formatDate(u.createdAt, locale)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-faint">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="tabular mt-2 font-serif text-2xl text-fg">{value}</p>
    </Card>
  );
}
