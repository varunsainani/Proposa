/**
 * Assemble a validated LLMQuoteDraft + matched data into the final QuoteData
 * (SPEC §6). Node owns ALL arithmetic — amounts, subtotal, total — and attaches
 * the matchedInputs "before" proof from the Python layer. The LLM is NEVER
 * trusted for math.
 *
 * These QuoteData / QuoteLineItem / MatchedInputs shapes mirror
 * frontend/src/lib/types.ts EXACTLY (keep in sync).
 */

import type { LLMQuoteDraft } from "../llm/types";
import type { MatchResult } from "./pyclient";

export interface QuoteLineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  amountCents: number;
  catalogItemId: string | null;
}

export interface MatchedInputs {
  constraints: {
    budgetCents: number | null;
    timelineText: string | null;
    keywords: string[];
  };
  rankedItems: {
    catalogItemId: string;
    name: string;
    score: number;
    unitPriceCents: number;
  }[];
  fx: { base: string; target: string; rate: number };
}

export interface QuoteData {
  summary: string;
  coverNote: string;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  timeline: { phase: string; duration: string }[];
  assumptions: string[];
  terms: string[];
  matchedInputs: MatchedInputs;
}

export interface AssembleArgs {
  draft: LLMQuoteDraft;
  matched: MatchResult;
  currency: string;
  /** Optional overrides; both default to 0 per SPEC. */
  discountCents?: number;
  taxCents?: number;
}

/** Build the MatchedInputs proof block from a Python (or fallback) MatchResult. */
export function toMatchedInputs(matched: MatchResult): MatchedInputs {
  return {
    constraints: {
      budgetCents: matched.constraints.budgetCents,
      timelineText: matched.constraints.timelineText,
      keywords: matched.constraints.keywords,
    },
    rankedItems: matched.rankedItems.map((it) => ({
      catalogItemId: it.catalogItemId,
      name: it.name,
      score: it.score,
      unitPriceCents: it.unitPriceCents,
    })),
    fx: {
      base: matched.fx.base,
      target: matched.fx.target,
      rate: matched.fx.rate,
    },
  };
}

function toInt(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
}

/**
 * Upper bound for any cents value. Safely below the Postgres int8 max and below
 * Number.MAX_SAFE_INTEGER, so a hallucinated huge-but-integer price cannot make
 * a total Infinity or overflow the INSERT. The downstream BigInt(Math.round())
 * then can never throw.
 */
const MAX_CENTS = 9_000_000_000_000; // 9e12

/** Clamp any number to a finite, nonnegative integer within [0, MAX_CENTS]. */
function safeCents(n: number): number {
  return Math.max(0, Math.min(Math.round(Number.isFinite(n) ? n : 0), MAX_CENTS));
}

/**
 * Produce the final QuoteData. Every amount is recomputed here:
 *   amountCents   = quantity * unitPriceCents   (per line)
 *   subtotalCents = sum(amountCents)
 *   totalCents    = subtotal - discount + tax
 */
export function assembleQuoteData(args: AssembleArgs): QuoteData {
  const { draft, matched, currency } = args;
  const discountCents = safeCents(toInt(args.discountCents, 0));
  const taxCents = safeCents(toInt(args.taxCents, 0));

  const lineItems: QuoteLineItem[] = draft.lineItems.map((li) => {
    // Clamp quantity to a sane finite integer so quantity * price stays bounded.
    const quantity = Math.max(0, Math.min(toInt(li.quantity, 1), 100000));
    const unitPriceCents = safeCents(toInt(li.unitPriceCents, 0));
    return {
      name: String(li.name ?? "").trim() || "Item",
      description: String(li.description ?? "").trim(),
      quantity,
      unit: String(li.unit ?? "").trim() || "item",
      unitPriceCents,
      amountCents: safeCents(quantity * unitPriceCents),
      catalogItemId:
        typeof li.catalogItemId === "string" && li.catalogItemId
          ? li.catalogItemId
          : null,
    };
  });

  const subtotalCents = safeCents(
    lineItems.reduce((sum, li) => sum + li.amountCents, 0),
  );
  const totalCents = safeCents(subtotalCents - discountCents + taxCents);

  return {
    summary: String(draft.summary ?? "").trim(),
    coverNote: String(draft.coverNote ?? "").trim(),
    lineItems,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
    currency,
    timeline: (draft.timeline ?? []).map((p) => ({
      phase: String(p.phase ?? "").trim(),
      duration: String(p.duration ?? "").trim(),
    })),
    assumptions: (draft.assumptions ?? []).map((a) => String(a).trim()).filter(Boolean),
    terms: (draft.terms ?? []).map((t) => String(t).trim()).filter(Boolean),
    matchedInputs: toMatchedInputs(matched),
  };
}
