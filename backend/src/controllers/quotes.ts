import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate } from "../lib/validate";
import { notFound } from "../lib/errors";

/**
 * Quotes CRUD scoped to req.user. The generate/refine/pdf handlers live in
 * controllers/quotes-gen (another agent) and are mounted in routes/quotes.ts.
 *
 * Serialization helpers below produce the exact Quote / QuoteListItem shapes
 * from frontend/src/lib/types.ts (dates as ISO strings, data as QuoteData JSON).
 */

type QuoteWithMessages = Prisma.QuoteGetPayload<{
  include: { messages: true };
}>;

function serializeMessage(m: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeQuote(q: QuoteWithMessages) {
  return {
    id: q.id,
    title: q.title,
    requestText: q.requestText,
    language: q.language,
    currency: q.currency,
    status: q.status,
    data: q.data,
    totalCents: Number(q.totalCents),
    model: q.model,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    messages: q.messages.map(serializeMessage),
  };
}

function serializeListItem(q: {
  id: string;
  title: string;
  language: string;
  currency: string;
  totalCents: bigint;
  status: "DRAFT" | "FINAL";
  createdAt: Date;
}) {
  return {
    id: q.id,
    title: q.title,
    language: q.language,
    currency: q.currency,
    totalCents: Number(q.totalCents),
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  };
}

// --- Schemas ---

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: z.enum(["DRAFT", "FINAL"]).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((s) => s.toUpperCase())
      .optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.status !== undefined ||
      v.currency !== undefined,
    { message: "error.validation" }
  );

// --- Handlers ---

export async function listQuotes(req: Request, res: Response): Promise<void> {
  const { limit } = validate(listQuerySchema, req.query, req.locale);

  const quotes = await prisma.quote.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      title: true,
      language: true,
      currency: true,
      totalCents: true,
      status: true,
      createdAt: true,
    },
  });

  res.json(quotes.map(serializeListItem));
}

export async function getQuote(req: Request, res: Response): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!quote) {
    throw notFound("quote.notFound");
  }

  res.json(serializeQuote(quote));
}

export async function patchQuote(req: Request, res: Response): Promise<void> {
  const body = validate(patchSchema, req.body, req.locale);

  const existing = await prisma.quote.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: { id: true, data: true },
  });
  if (!existing) {
    throw notFound("quote.notFound");
  }

  const data: {
    title?: string;
    status?: "DRAFT" | "FINAL";
    currency?: string;
    data?: Prisma.InputJsonValue;
  } = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.status !== undefined) data.status = body.status;
  if (body.currency !== undefined) {
    data.currency = body.currency;
    // Keep the embedded QuoteData.currency label in sync with the column.
    const current = existing.data as Record<string, unknown> | null;
    if (current && typeof current === "object") {
      data.data = {
        ...(current as Record<string, unknown>),
        currency: body.currency,
      } as Prisma.InputJsonValue;
    }
  }

  const updated = await prisma.quote.update({
    where: { id: existing.id },
    data,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  res.json(serializeQuote(updated));
}

export async function deleteQuote(req: Request, res: Response): Promise<void> {
  const existing = await prisma.quote.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: { id: true },
  });
  if (!existing) {
    throw notFound("quote.notFound");
  }

  await prisma.quote.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}
