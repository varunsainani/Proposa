// Shared API contract types - mirror backend SPEC. Keep in sync.

export type Role = "USER" | "ADMIN";
export type QuoteStatus = "DRAFT" | "FINAL";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
}

export interface CatalogItem {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  unitPriceCents: number;
  currency: string;
  tags: string[];
  defaultQty: number;
  active: boolean;
}

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

export interface QuoteMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface QuoteListItem {
  id: string;
  title: string;
  language: string;
  currency: string;
  totalCents: number;
  status: QuoteStatus;
  createdAt: string;
}

export interface Quote {
  id: string;
  title: string;
  requestText: string;
  language: string;
  currency: string;
  status: QuoteStatus;
  data: QuoteData;
  totalCents: number;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: QuoteMessage[];
}

export interface AdminOverview {
  stats: {
    users: number;
    quotes: number;
    totalValueCents: number;
    avgQuoteCents: number;
  };
  recentQuotes: (QuoteListItem & { user: { name: string; email: string } })[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  quoteCount: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
