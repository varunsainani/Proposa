/**
 * LLM orchestration (SPEC §7).
 *
 *  getProvider()        — pick the provider from env.LLM_PROVIDER (default gemini).
 *  generateQuoteData()  — call provider, validate with zod, retry ONCE on bad
 *                         output, then fall back to a DETERMINISTIC draft built
 *                         from the matched items. NEVER throws to the user.
 *  refineQuoteData()    — same robustness for refinement; deterministic fallback
 *                         keeps the current draft's creative text and re-prices
 *                         from matched items.
 *
 * Both return a validated LLMQuoteDraft. The controller then assembles QuoteData
 * via lib/quote-assemble.ts (which owns all arithmetic).
 */

import { z } from "zod";
import { env } from "../lib/env";
import type { MatchResult } from "../lib/pyclient";
import type { QuoteData } from "../lib/quote-assemble";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type {
  ChatTurn,
  GenerateArgs,
  Language,
  LLMProvider,
  LLMQuoteDraft,
} from "./types";

/** zod schema for the LLM-returned draft. Coerces light type slips, rejects junk. */
const lineItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  quantity: z.coerce.number().int().positive().max(100000),
  unit: z.string().min(1),
  unitPriceCents: z.coerce.number().int().nonnegative().max(1_000_000_000_000),
  catalogItemId: z.string().nullish().transform((v) => v ?? null),
});

const draftSchema = z.object({
  summary: z.string().min(1),
  coverNote: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  timeline: z
    .array(z.object({ phase: z.string().min(1), duration: z.string().min(1) }))
    .default([]),
  assumptions: z.array(z.string()).default([]),
  terms: z.array(z.string()).default([]),
});

export function getProvider(): LLMProvider {
  return env.LLM_PROVIDER === "anthropic" ? anthropicProvider : geminiProvider;
}

/** The model name to persist on Quote.model for the active provider. */
export function providerModelName(): string {
  return getProvider().name;
}

/** Validate raw provider output; returns null if it does not satisfy the schema. */
function validateDraft(raw: unknown): LLMQuoteDraft | null {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    summary: parsed.data.summary,
    coverNote: parsed.data.coverNote,
    lineItems: parsed.data.lineItems.map((li) => ({
      name: li.name,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unitPriceCents: li.unitPriceCents,
      catalogItemId: li.catalogItemId,
    })),
    timeline: parsed.data.timeline,
    assumptions: parsed.data.assumptions,
    terms: parsed.data.terms,
  };
}

/** Localized-ish fixed strings for the deterministic fallback, by language. */
const FALLBACK_TEXT: Record<
  Language,
  {
    summary: string;
    coverNote: string;
    timeline: { phase: string; duration: string }[];
    assumptions: string[];
    terms: string[];
  }
> = {
  en: {
    summary:
      "A tailored proposal covering the services that best match your request.",
    coverNote:
      "Thank you for the opportunity to put this proposal together. Below is an itemized scope based on your request, with clear pricing and a realistic timeline. We would be glad to refine any part of it to better fit your needs.",
    timeline: [
      { phase: "Discovery & planning", duration: "1 week" },
      { phase: "Execution", duration: "3-4 weeks" },
      { phase: "Review & handoff", duration: "1 week" },
    ],
    assumptions: [
      "Scope is based on the information provided in the request.",
      "Timely feedback and approvals will be provided at each milestone.",
      "Third-party costs (licenses, hosting) are billed separately.",
    ],
    terms: [
      "50% deposit to begin, balance on delivery.",
      "Quote valid for 30 days.",
      "Two rounds of revisions are included per deliverable.",
    ],
  },
  es: {
    summary:
      "Una propuesta a medida que cubre los servicios que mejor se ajustan a su solicitud.",
    coverNote:
      "Gracias por la oportunidad de preparar esta propuesta. A continuación encontrará un alcance detallado basado en su solicitud, con precios claros y un cronograma realista. Con gusto ajustaremos cualquier parte para adaptarla mejor a sus necesidades.",
    timeline: [
      { phase: "Descubrimiento y planificación", duration: "1 semana" },
      { phase: "Ejecución", duration: "3-4 semanas" },
      { phase: "Revisión y entrega", duration: "1 semana" },
    ],
    assumptions: [
      "El alcance se basa en la información proporcionada en la solicitud.",
      "Se brindarán comentarios y aprobaciones oportunas en cada hito.",
      "Los costos de terceros (licencias, alojamiento) se facturan por separado.",
    ],
    terms: [
      "50% de anticipo para comenzar, saldo a la entrega.",
      "Presupuesto válido por 30 días.",
      "Se incluyen dos rondas de revisiones por entregable.",
    ],
  },
  pt: {
    summary:
      "Uma proposta sob medida que cobre os serviços que melhor atendem à sua solicitação.",
    coverNote:
      "Agradecemos a oportunidade de preparar esta proposta. Abaixo está um escopo detalhado com base na sua solicitação, com preços claros e um cronograma realista. Teremos prazer em ajustar qualquer parte para atender melhor às suas necessidades.",
    timeline: [
      { phase: "Descoberta e planejamento", duration: "1 semana" },
      { phase: "Execução", duration: "3-4 semanas" },
      { phase: "Revisão e entrega", duration: "1 semana" },
    ],
    assumptions: [
      "O escopo é baseado nas informações fornecidas na solicitação.",
      "Feedback e aprovações serão fornecidos a tempo em cada marco.",
      "Custos de terceiros (licenças, hospedagem) são cobrados separadamente.",
    ],
    terms: [
      "50% de entrada para iniciar, saldo na entrega.",
      "Orçamento válido por 30 dias.",
      "Duas rodadas de revisões incluídas por entregável.",
    ],
  },
};

/**
 * Build a usable draft directly from the matched ranked items — no model needed.
 * Used when the provider output is unusable twice in a row, so the user always
 * gets a real, priced proposal instead of an error.
 */
export function deterministicDraft(
  matched: MatchResult,
  language: Language,
  current?: QuoteData
): LLMQuoteDraft {
  const text = FALLBACK_TEXT[language] ?? FALLBACK_TEXT.en;

  // Prefer the current quote's line items on refine; else derive from matched.
  let lineItems: LLMQuoteDraft["lineItems"];
  if (current && current.lineItems.length) {
    lineItems = current.lineItems.map((li) => ({
      name: li.name,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unitPriceCents: li.unitPriceCents,
      catalogItemId: li.catalogItemId,
    }));
  } else {
    const top = matched.rankedItems.slice(0, 6);
    lineItems = (top.length ? top : []).map((it) => ({
      name: it.name || "Service",
      description: "",
      quantity: it.suggestedQty > 0 ? it.suggestedQty : 1,
      unit: it.unit || "item",
      unitPriceCents: it.unitPriceCents,
      catalogItemId: it.catalogItemId,
    }));
    if (!lineItems.length) {
      // Absolute last resort so assemble has at least one line.
      lineItems = [
        {
          name: text.summary,
          description: "",
          quantity: 1,
          unit: "project",
          unitPriceCents: 0,
          catalogItemId: null,
        },
      ];
    }
  }

  return {
    summary: current?.summary || text.summary,
    coverNote: current?.coverNote || text.coverNote,
    lineItems,
    timeline: current?.timeline?.length ? current.timeline : text.timeline,
    assumptions: current?.assumptions?.length
      ? current.assumptions
      : text.assumptions,
    terms: current?.terms?.length ? current.terms : text.terms,
  };
}

/**
 * Generate a validated draft. Calls the provider, validates; on malformed output
 * retries ONCE; if still bad, returns the deterministic draft. Never throws.
 */
export async function generateQuoteData(
  args: GenerateArgs
): Promise<LLMQuoteDraft> {
  const provider = getProvider();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await provider.generateQuote(args);
      const valid = validateDraft(raw);
      if (valid) return valid;
      // eslint-disable-next-line no-console
      console.warn(`[llm] generate produced invalid draft (attempt ${attempt + 1}).`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[llm] generate attempt ${attempt + 1} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // eslint-disable-next-line no-console
  console.warn("[llm] falling back to deterministic generate draft.");
  return deterministicDraft(args.matched, args.language);
}

export interface RefineDataArgs {
  current: QuoteData;
  history: ChatTurn[];
  instruction: string;
  language: Language;
  currency: string;
  matched: MatchResult;
}

/**
 * Refine an existing quote. Same retry-once + deterministic fallback discipline.
 * The deterministic fallback keeps the current quote's content (so a transient
 * model failure does not wipe the user's proposal).
 */
export async function refineQuoteData(
  args: RefineDataArgs
): Promise<LLMQuoteDraft> {
  const provider = getProvider();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await provider.refineQuote(args);
      const valid = validateDraft(raw);
      if (valid) return valid;
      // eslint-disable-next-line no-console
      console.warn(`[llm] refine produced invalid draft (attempt ${attempt + 1}).`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[llm] refine attempt ${attempt + 1} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // eslint-disable-next-line no-console
  console.warn("[llm] falling back to deterministic refine draft.");
  return deterministicDraft(args.matched, args.language, args.current);
}
