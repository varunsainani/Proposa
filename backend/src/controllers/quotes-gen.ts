/**
 * Quote generation / refinement / PDF controllers (SPEC §4, §7).
 *
 * Mounted by routes/quotes.ts:
 *   POST /quotes/generate     -> generateQuote
 *   POST /quotes/:id/refine   -> refineQuote
 *   GET  /quotes/:id/pdf      -> quotePdf
 *
 * Generation pipeline: validate -> daily-cap -> load active catalog -> callMatch
 * (Python or local fallback) -> generateQuoteData (LLM + zod + deterministic
 * fallback) -> assembleQuoteData (Node owns all math) -> persist -> return Quote.
 * A bad LLM response never 500s: the LLM layer always returns a valid draft.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate } from "../lib/validate";
import { notFound, rateLimited } from "../lib/errors";
import { env } from "../lib/env";
import { callMatch, type CatalogItemRow } from "../lib/pyclient";
import {
  generateQuoteData,
  refineQuoteData,
  providerModelName,
} from "../llm";
import {
  assembleQuoteData,
  type QuoteData,
} from "../lib/quote-assemble";
import { renderQuotePdf } from "../lib/pdf";
import { serializeQuote } from "./quotes";
import type { ChatTurn, Language } from "../llm/types";

// --- Schemas ---

const generateSchema = z.object({
  requestText: z.string().trim().min(1).max(5000),
  language: z.enum(["en", "es", "pt"]),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, { message: "validation.invalidCurrency" })
    .transform((s) => s.toUpperCase()),
});

const refineSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

// --- Helpers ---

/** Load the active catalog as the rows the matcher/LLM need. */
async function loadActiveCatalog(): Promise<CatalogItemRow[]> {
  const items = await prisma.catalogItem.findMany({
    where: { active: true },
    orderBy: { category: "asc" },
    select: {
      id: true,
      category: true,
      name: true,
      description: true,
      unit: true,
      unitPriceCents: true,
      currency: true,
      tags: true,
      defaultQty: true,
    },
  });
  return items;
}

/** Enforce the per-user/day generation cap (SPEC §4). */
async function assertUnderDailyCap(userId: string): Promise<void> {
  const cap = env.GEN_DAILY_CAP;
  if (!cap || cap <= 0) return;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const count = await prisma.quote.count({
    where: { userId, createdAt: { gte: startOfDay } },
  });

  if (count >= cap) {
    throw rateLimited("quote.dailyCapReached", { cap });
  }
}

/** Derive a concise human title from the summary (preferred) or request text. */
function deriveTitle(summary: string, requestText: string): string {
  const source = (summary || requestText || "Proposal").replace(/\s+/g, " ").trim();
  // First sentence, capped to a tidy length.
  const firstSentence = source.split(/(?<=[.!?])\s/)[0] || source;
  let title = firstSentence.length > 80 ? firstSentence.slice(0, 77) + "..." : firstSentence;
  title = title.replace(/[.]+$/, "").trim();
  return title || "Proposal";
}

/** A short one-line assistant summary of what a refinement changed. */
function changeSummary(before: QuoteData, after: QuoteData): string {
  const parts: string[] = [];
  if (before.lineItems.length !== after.lineItems.length) {
    const delta = after.lineItems.length - before.lineItems.length;
    parts.push(
      delta > 0
        ? `added ${delta} line item${delta === 1 ? "" : "s"}`
        : `removed ${-delta} line item${-delta === 1 ? "" : "s"}`
    );
  }
  if (before.totalCents !== after.totalCents) {
    const dir = after.totalCents > before.totalCents ? "increased" : "decreased";
    parts.push(
      `total ${dir} to ${(after.totalCents / 100).toFixed(2)} ${after.currency}`
    );
  }
  if (!parts.length) parts.push("updated the proposal per your request");
  return `Updated the proposal: ${parts.join("; ")}.`;
}

// --- Handlers ---

export async function generateQuote(req: Request, res: Response): Promise<void> {
  const body = validate(generateSchema, req.body, req.locale);
  const userId = req.user!.id;

  await assertUnderDailyCap(userId);

  const catalog = await loadActiveCatalog();

  const matched = await callMatch({
    request: {
      text: body.requestText,
      language: body.language,
      currency: body.currency,
    },
    catalog,
  });

  const draft = await generateQuoteData({
    requestText: body.requestText,
    language: body.language as Language,
    currency: body.currency,
    matched,
  });

  const data = assembleQuoteData({ draft, matched, currency: body.currency });
  const title = deriveTitle(data.summary, body.requestText);

  const created = await prisma.quote.create({
    data: {
      userId,
      title,
      requestText: body.requestText,
      language: body.language,
      currency: body.currency,
      status: "DRAFT",
      data: data as unknown as Prisma.InputJsonValue,
      totalCents: BigInt(Math.round(data.totalCents)),
      model: providerModelName(),
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  res.status(201).json(serializeQuote(created));
}

export async function refineQuote(req: Request, res: Response): Promise<void> {
  const body = validate(refineSchema, req.body, req.locale);
  const userId = req.user!.id;

  const existing = await prisma.quote.findFirst({
    where: { id: req.params.id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!existing) {
    throw notFound("quote.notFound");
  }

  const currentData = existing.data as unknown as QuoteData;
  const language = existing.language as Language;
  const currency = existing.currency;

  // Reuse the matchedInputs already proven on the current quote (SPEC allows
  // reuse). Reconstruct a MatchResult from it so the LLM still has priced
  // reference items + constraints + fx.
  const matched = {
    constraints: {
      budgetCents: currentData.matchedInputs?.constraints?.budgetCents ?? null,
      timelineText: currentData.matchedInputs?.constraints?.timelineText ?? null,
      keywords: currentData.matchedInputs?.constraints?.keywords ?? [],
    },
    rankedItems: (currentData.matchedInputs?.rankedItems ?? []).map((it) => ({
      catalogItemId: it.catalogItemId,
      name: it.name,
      category: "",
      unit: "item",
      unitPriceCents: it.unitPriceCents,
      score: it.score,
      suggestedQty: 1,
    })),
    fx: {
      base: currentData.matchedInputs?.fx?.base ?? "USD",
      target: currentData.matchedInputs?.fx?.target ?? currency,
      rate: currentData.matchedInputs?.fx?.rate ?? 1.0,
    },
  };

  const history: ChatTurn[] = existing.messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const draft = await refineQuoteData({
    current: currentData,
    history,
    instruction: body.message,
    language,
    currency,
    matched,
  });

  const newData = assembleQuoteData({ draft, matched, currency });
  const assistantNote = changeSummary(currentData, newData);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: existing.id },
      data: {
        data: newData as unknown as Prisma.InputJsonValue,
        totalCents: BigInt(Math.round(newData.totalCents)),
      },
    });
    await tx.quoteMessage.create({
      data: { quoteId: existing.id, role: "user", content: body.message },
    });
    await tx.quoteMessage.create({
      data: { quoteId: existing.id, role: "assistant", content: assistantNote },
    });
    return tx.quote.findUniqueOrThrow({
      where: { id: existing.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  });

  res.json(serializeQuote(updated));
}

export async function quotePdf(req: Request, res: Response): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: {
      id: true,
      title: true,
      language: true,
      currency: true,
      createdAt: true,
      data: true,
    },
  });
  if (!quote) {
    throw notFound("quote.notFound");
  }

  const bytes = await renderQuotePdf({
    id: quote.id,
    title: quote.title,
    language: quote.language,
    currency: quote.currency,
    createdAt: quote.createdAt,
    data: quote.data as unknown as QuoteData,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="proposal-${quote.id}.pdf"`
  );
  res.setHeader("Content-Length", String(bytes.length));
  res.end(Buffer.from(bytes));
}
