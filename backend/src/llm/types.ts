/**
 * LLM layer types (SPEC §6/§7).
 *
 * The LLM returns only a SUBSET of QuoteData — the creative parts. Node computes
 * all arithmetic (amounts, subtotal, total), sets the currency, and attaches the
 * matchedInputs proof from the Python layer (see lib/quote-assemble.ts). NEVER
 * trust the model for math.
 */

import type { MatchResult } from "../lib/pyclient";

/** Supported proposal output languages. */
export type Language = "en" | "es" | "pt";

/**
 * A line item exactly as returned by the LLM. `unitPriceCents` is an integer in
 * the requested currency; `catalogItemId` is null when the model invents an item.
 */
export interface LLMLineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  catalogItemId: string | null;
}

export interface LLMTimelinePhase {
  phase: string;
  duration: string;
}

/**
 * The full draft the LLM is asked to produce (SPEC §6 — the LLM-returned subset).
 * Validated with zod in llm/index.ts before it is ever assembled.
 */
export interface LLMQuoteDraft {
  summary: string;
  coverNote: string;
  lineItems: LLMLineItem[];
  timeline: LLMTimelinePhase[];
  assumptions: string[];
  terms: string[];
}

/** A single chat turn used when refining an existing quote. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Args for a fresh generation. */
export interface GenerateArgs {
  requestText: string;
  language: Language;
  currency: string;
  matched: MatchResult;
}

/** Args for a refinement of an existing quote. */
export interface RefineArgs {
  current: import("../lib/quote-assemble").QuoteData;
  history: ChatTurn[];
  instruction: string;
  language: Language;
  currency: string;
  matched: MatchResult;
}

/**
 * Model-agnostic provider contract (SPEC §7). Each provider performs a single
 * round-trip and returns a parsed (but not-yet-validated) LLMQuoteDraft.
 * Implementations throw AppError(LLM_ERROR) on HTTP/parse failure.
 */
export interface LLMProvider {
  /** Identifier persisted on Quote.model, e.g. "gemini-flash-latest". */
  readonly name: string;
  generateQuote(args: GenerateArgs): Promise<LLMQuoteDraft>;
  refineQuote(args: RefineArgs): Promise<LLMQuoteDraft>;
}
