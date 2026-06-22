/**
 * Client for the Python data-gathering / matching service (SPEC §5).
 *
 * Node calls `${PY_SERVICE_URL}/match` server-to-server with the shared-secret
 * header. The browser never reaches Python. On any failure we PREFER a safe
 * local fallback (empty constraints, top catalog by keyword overlap, FX rate 1.0)
 * so generation still works when Python is down — rather than throwing.
 */

import { env } from "./env";

/** A catalog row as stored in the DB (the subset Python needs). */
export interface CatalogItemRow {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  unitPriceCents: number; // base currency USD
  currency: string;
  tags: string[];
  defaultQty: number;
}

/** Parsed constraints from the request text (SPEC §5). */
export interface MatchConstraints {
  budgetCents: number | null;
  budgetCurrency?: string | null;
  timelineText: string | null;
  keywords: string[];
}

/**
 * A ranked catalog item. `unitPriceCents` here is ALREADY FX-converted into the
 * request currency by Python (so it is the allowed price reference for the LLM).
 */
export interface RankedItem {
  catalogItemId: string;
  name: string;
  category: string;
  unit: string;
  unitPriceCents: number; // FX-converted into the request currency
  score: number;
  suggestedQty: number;
}

export interface FxBlock {
  base: string;
  target: string;
  rate: number;
  asOf?: string;
}

export interface MatchResult {
  constraints: MatchConstraints;
  rankedItems: RankedItem[];
  fx: FxBlock;
}

export interface MatchArgs {
  request: { text: string; language: string; currency: string };
  catalog: CatalogItemRow[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "with",
  "we", "i", "our", "my", "need", "want", "would", "like", "please", "is",
  "are", "be", "have", "has", "that", "this", "it", "as", "at", "by", "from",
  "will", "can", "should", "could", "about", "into", "your", "you", "me",
  "us", "they", "their", "them", "also", "some", "any", "all",
]);

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñçãõâêôà\s]/gi, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Deterministic local fallback used when Python is unreachable. Scores each
 * catalog item by keyword/tag/category overlap with the request, returns the
 * top ~12, and uses FX rate 1.0 (prices stay in base USD). Generation still
 * works; the proposal is just built without the enriched Python signals.
 */
export function localFallbackMatch(args: MatchArgs): MatchResult {
  const reqTokens = new Set(tokenize(args.request.text));

  const scored = args.catalog.map((item) => {
    const haystack = new Set([
      ...tokenize(item.name),
      ...tokenize(item.description),
      ...tokenize(item.category),
      ...item.tags.flatMap((tag) => tokenize(tag)),
    ]);
    let overlap = 0;
    for (const tok of reqTokens) if (haystack.has(tok)) overlap += 1;
    const denom = reqTokens.size || 1;
    const score = Math.min(1, overlap / denom);
    return { item, score };
  });

  // If nothing overlaps at all, keep a stable preview so the LLM still has
  // priced reference items to choose from.
  const anyOverlap = scored.some((s) => s.score > 0);
  const ranked = (anyOverlap ? scored.filter((s) => s.score > 0) : scored)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 12)
    .map(({ item, score }) => ({
      catalogItemId: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents, // rate 1.0 → stays USD-based
      score: anyOverlap ? Number(score.toFixed(2)) : 0.1,
      suggestedQty: item.defaultQty > 0 ? item.defaultQty : 1,
    }));

  return {
    constraints: { budgetCents: null, timelineText: null, keywords: [] },
    rankedItems: ranked,
    fx: { base: "USD", target: args.request.currency, rate: 1.0 },
  };
}

/**
 * Call the Python /match endpoint. On HTTP/network/parse failure, returns the
 * deterministic local fallback (preferred per SPEC) so generation never blocks
 * on Python being unavailable.
 */
export async function callMatch(args: MatchArgs): Promise<MatchResult> {
  const url = `${env.PY_SERVICE_URL.replace(/\/+$/, "")}/match`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": env.PY_SHARED_SECRET,
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[pyclient] /match returned ${res.status}; using local fallback.`
      );
      return localFallbackMatch(args);
    }

    const data = (await res.json()) as Partial<MatchResult>;
    return normalizeMatchResult(data, args);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[pyclient] /match failed (${
        err instanceof Error ? err.message : String(err)
      }); using local fallback.`
    );
    return localFallbackMatch(args);
  } finally {
    clearTimeout(timer);
  }
}

/** Defensively coerce a Python response into a well-formed MatchResult. */
function normalizeMatchResult(
  data: Partial<MatchResult>,
  args: MatchArgs
): MatchResult {
  const fallback = localFallbackMatch(args);

  const constraints: MatchConstraints = {
    budgetCents:
      typeof data.constraints?.budgetCents === "number"
        ? data.constraints.budgetCents
        : null,
    timelineText:
      typeof data.constraints?.timelineText === "string"
        ? data.constraints.timelineText
        : null,
    keywords: Array.isArray(data.constraints?.keywords)
      ? data.constraints!.keywords.filter((k): k is string => typeof k === "string")
      : [],
  };

  const rankedItems: RankedItem[] = Array.isArray(data.rankedItems)
    ? data.rankedItems
        .filter(
          (it): it is RankedItem =>
            !!it &&
            typeof it.catalogItemId === "string" &&
            typeof it.unitPriceCents === "number"
        )
        .map((it) => ({
          catalogItemId: it.catalogItemId,
          name: typeof it.name === "string" ? it.name : "",
          category: typeof it.category === "string" ? it.category : "",
          unit: typeof it.unit === "string" ? it.unit : "item",
          unitPriceCents: Math.round(it.unitPriceCents),
          score: typeof it.score === "number" ? it.score : 0,
          suggestedQty:
            typeof it.suggestedQty === "number" && it.suggestedQty > 0
              ? Math.round(it.suggestedQty)
              : 1,
        }))
    : fallback.rankedItems;

  const fx: FxBlock = {
    base: typeof data.fx?.base === "string" ? data.fx.base : "USD",
    target:
      typeof data.fx?.target === "string" ? data.fx.target : args.request.currency,
    rate: typeof data.fx?.rate === "number" && data.fx.rate > 0 ? data.fx.rate : 1.0,
    asOf: typeof data.fx?.asOf === "string" ? data.fx.asOf : undefined,
  };

  return { constraints, rankedItems, fx };
}
