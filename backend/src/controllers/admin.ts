import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * Admin endpoints (requireAdmin). Match AdminOverview / AdminUser in types.ts.
 */

function listItemWithUser(q: {
  id: string;
  title: string;
  language: string;
  currency: string;
  totalCents: bigint;
  status: "DRAFT" | "FINAL";
  createdAt: Date;
  user: { name: string; email: string };
}) {
  return {
    id: q.id,
    title: q.title,
    language: q.language,
    currency: q.currency,
    totalCents: Number(q.totalCents),
    status: q.status,
    createdAt: q.createdAt.toISOString(),
    user: { name: q.user.name, email: q.user.email },
  };
}

export async function overview(_req: Request, res: Response): Promise<void> {
  const [users, quotes, allTotals, recent] = await Promise.all([
    prisma.user.count(),
    prisma.quote.count(),
    // totalCents is BigInt (weak-currency totals exceed Int); sum/avg in JS via
    // Number() to avoid BigInt-aggregate typing. Number is safe up to 2^53.
    prisma.quote.findMany({ select: { totalCents: true } }),
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        language: true,
        currency: true,
        totalCents: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const totalValueCents = allTotals.reduce((s, q) => s + Number(q.totalCents), 0);
  const avgQuoteCents = allTotals.length
    ? Math.round(totalValueCents / allTotals.length)
    : 0;

  res.json({
    stats: {
      users,
      quotes,
      totalValueCents,
      avgQuoteCents,
    },
    recentQuotes: recent.map(listItemWithUser),
  });
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { quotes: true } },
    },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      quoteCount: u._count.quotes,
    }))
  );
}

export async function listAllQuotes(
  _req: Request,
  res: Response
): Promise<void> {
  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      language: true,
      currency: true,
      totalCents: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  res.json(quotes.map(listItemWithUser));
}
