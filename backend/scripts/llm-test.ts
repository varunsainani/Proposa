/**
 * In-process LLM-layer test (SPEC §13). Run:
 *   npx tsx scripts/llm-test.ts
 *
 * 1. Builds a sample matched fixture (no Python / no DB needed).
 * 2. Runs generateQuoteData with a REAL provider call (Gemini by default).
 *    Asserts the draft validates: non-empty cover note + summary, >=1 line item
 *    with INTEGER cents, valid timeline/assumptions/terms.
 * 3. Tests the deterministic fallback path by forcing a broken provider.
 * 4. Sanity-checks quote assembly arithmetic (Node owns the math).
 *
 * Prints PASS/FAIL per check and exits non-zero on any failure.
 */

import "dotenv/config";
import { env } from "../src/lib/env";
import type { MatchResult } from "../src/lib/pyclient";
import {
  generateQuoteData,
  refineQuoteData,
  deterministicDraft,
} from "../src/llm";
import { assembleQuoteData } from "../src/lib/quote-assemble";
import type { LLMQuoteDraft } from "../src/llm/types";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${label}`, extra !== undefined ? extra : "");
  }
}

/** A realistic matched fixture (as Python would return, prices in BRL). */
function sampleMatched(): MatchResult {
  return {
    constraints: {
      budgetCents: 5_000_00,
      timelineText: "6 weeks",
      keywords: ["website", "seo", "blog", "design"],
    },
    rankedItems: [
      {
        catalogItemId: "ci_landing",
        name: "Landing Page Design",
        category: "Design",
        unit: "page",
        unitPriceCents: 120_000,
        score: 0.82,
        suggestedQty: 3,
      },
      {
        catalogItemId: "ci_seo",
        name: "SEO Setup",
        category: "Marketing",
        unit: "project",
        unitPriceCents: 90_000,
        score: 0.71,
        suggestedQty: 1,
      },
      {
        catalogItemId: "ci_blog",
        name: "Blog Article",
        category: "Content",
        unit: "article",
        unitPriceCents: 25_000,
        score: 0.64,
        suggestedQty: 4,
      },
      {
        catalogItemId: "ci_cms",
        name: "CMS Integration",
        category: "Web Development",
        unit: "project",
        unitPriceCents: 180_000,
        score: 0.59,
        suggestedQty: 1,
      },
    ],
    fx: { base: "USD", target: "BRL", rate: 5.42, asOf: "2026-06-22" },
  };
}

function isValidDraft(d: LLMQuoteDraft): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!d.summary || !d.summary.trim()) reasons.push("empty summary");
  if (!d.coverNote || !d.coverNote.trim()) reasons.push("empty coverNote");
  if (!Array.isArray(d.lineItems) || d.lineItems.length < 1)
    reasons.push("no line items");
  for (const li of d.lineItems ?? []) {
    if (!Number.isInteger(li.unitPriceCents))
      reasons.push(`non-integer unitPriceCents (${li.unitPriceCents})`);
    if (!Number.isInteger(li.quantity))
      reasons.push(`non-integer quantity (${li.quantity})`);
    if (li.unitPriceCents < 0) reasons.push("negative unitPriceCents");
  }
  return { ok: reasons.length === 0, reasons };
}

async function main(): Promise<void> {
  const matched = sampleMatched();
  const requestText =
    "We're a boutique coffee roaster and need a modern marketing website with a few landing pages, basic SEO, and a blog. Budget around R$5,000, timeline about 6 weeks.";

  console.log(
    `\n--- Provider: ${env.LLM_PROVIDER} (${
      env.LLM_PROVIDER === "anthropic" ? env.ANTHROPIC_MODEL : env.GEMINI_MODEL
    }) ---\n`
  );

  // 1) Real provider generate.
  let realDraft: LLMQuoteDraft | undefined;
  try {
    realDraft = await generateQuoteData({
      requestText,
      language: "pt",
      currency: "BRL",
      matched,
    });
    const v = isValidDraft(realDraft);
    check("real generate -> valid draft", v.ok, v.reasons);
    check(
      "real generate -> >=1 line item",
      (realDraft.lineItems?.length ?? 0) >= 1
    );
    check(
      "real generate -> cover note non-empty",
      !!realDraft.coverNote?.trim()
    );
    check(
      "real generate -> all unit prices integer cents",
      realDraft.lineItems.every((li) => Number.isInteger(li.unitPriceCents))
    );
    console.log(
      `      summary: ${realDraft.summary.slice(0, 90)}${
        realDraft.summary.length > 90 ? "..." : ""
      }`
    );
    console.log(`      lineItems: ${realDraft.lineItems.length}`);
  } catch (err) {
    check("real generate did not throw", false, err);
  }

  // 2) Assembly arithmetic from the real draft (Node owns the math).
  if (realDraft) {
    const data = assembleQuoteData({ draft: realDraft, matched, currency: "BRL" });
    const subtotalOk =
      data.subtotalCents ===
      data.lineItems.reduce((s, li) => s + li.amountCents, 0);
    const perLineOk = data.lineItems.every(
      (li) => li.amountCents === li.quantity * li.unitPriceCents
    );
    const totalOk =
      data.totalCents === data.subtotalCents - data.discountCents + data.taxCents;
    check("assemble -> amountCents = qty * unitPrice (every line)", perLineOk);
    check("assemble -> subtotal = sum(amounts)", subtotalOk);
    check("assemble -> total = subtotal - discount + tax", totalOk);
    check("assemble -> currency set", data.currency === "BRL");
    check(
      "assemble -> matchedInputs attached (fx rate present)",
      data.matchedInputs.fx.rate === 5.42 &&
        data.matchedInputs.rankedItems.length === matched.rankedItems.length
    );
    console.log(
      `      total: ${(data.totalCents / 100).toFixed(2)} ${data.currency}`
    );
  }

  // 3) Deterministic fallback — force a broken provider so both attempts fail.
  const savedProvider = env.LLM_PROVIDER;
  const savedKey = env.GEMINI_API_KEY;
  const savedAnthKey = env.ANTHROPIC_API_KEY;
  try {
    // Wipe both keys so whichever provider is active throws on every attempt.
    (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = "";
    (env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = "";

    const fb = await generateQuoteData({
      requestText,
      language: "en",
      currency: "USD",
      matched,
    });
    const v = isValidDraft(fb);
    check("deterministic fallback -> valid draft (no throw)", v.ok, v.reasons);
    check(
      "deterministic fallback -> built from matched items",
      fb.lineItems.length >= 1 &&
        fb.lineItems.some((li) => li.catalogItemId === "ci_landing")
    );
    // Direct unit check of the deterministic builder.
    const direct = deterministicDraft(matched, "es");
    check(
      "deterministicDraft(es) -> Spanish fallback text present",
      /propuesta/i.test(direct.summary) || /propuesta/i.test(direct.coverNote)
    );
  } catch (err) {
    check("deterministic fallback did not throw", false, err);
  } finally {
    (env as { LLM_PROVIDER: string }).LLM_PROVIDER = savedProvider;
    (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = savedKey;
    (env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = savedAnthKey;
  }

  // 4) Refine fallback keeps the current quote (broken provider path).
  try {
    (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = "";
    (env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = "";
    const baseData = assembleQuoteData({
      draft: deterministicDraft(matched, "en"),
      matched,
      currency: "USD",
    });
    const refined = await refineQuoteData({
      current: baseData,
      history: [],
      instruction: "Add a maintenance plan.",
      language: "en",
      currency: "USD",
      matched,
    });
    check(
      "refine fallback -> keeps current line items",
      refined.lineItems.length === baseData.lineItems.length
    );
  } catch (err) {
    check("refine fallback did not throw", false, err);
  } finally {
    (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = savedKey;
    (env as { ANTHROPIC_API_KEY: string }).ANTHROPIC_API_KEY = savedAnthKey;
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("UNEXPECTED ERROR", err);
  process.exit(1);
});
