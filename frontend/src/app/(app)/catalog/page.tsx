"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  fieldBase,
  Skeleton,
} from "@/components/ui";

export default function CatalogPage() {
  const t = useTranslations("catalog");
  const locale = useLocale();

  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<CatalogItem[]>("/catalog");
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) {
          setError(true);
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          className={`${fieldBase} pl-9`}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("search")}
        />
      </div>

      {items === null ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g}>
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={BookOpen} title={t("loadFailed")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div className="space-y-9">
          {grouped.map(([category, group]) => (
            <section key={category}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-serif text-xl text-fg">{category}</h2>
                <span className="text-sm text-faint">{t("itemsCount", { count: group.length })}</span>
                <span className="h-px flex-1 self-center bg-[var(--border)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((it) => (
                  <Card key={it.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium leading-snug text-fg">{it.name}</h3>
                        <span className="tabular shrink-0 font-serif text-base text-fg">
                          {formatCurrency(it.unitPriceCents, it.currency, locale)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-faint">/ {it.unit}</p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col pt-0">
                      <p className="text-sm leading-relaxed text-muted">{it.description}</p>
                      {it.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {it.tags.map((tag) => (
                            <Badge key={tag} tone="neutral">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
