/**
 * Model-agnostic prompt builders for generate + refine (SPEC §7).
 *
 * Both Gemini and Anthropic providers use these. The prompt:
 *  - is strict about output: ONLY a single JSON object of the LLMQuoteDraft schema
 *  - writes the whole proposal in the requested `language` (en|es|pt)
 *  - gives the matched catalog items (with FX-converted unit prices) as the
 *    allowed price reference; line items should be chosen/quantified from them
 *    where sensible, though reasonable extra items are allowed
 *  - requires unit prices as INTEGER CENTS in the given currency
 */

import type { GenerateArgs, RefineArgs, Language } from "./types";
import type { MatchResult } from "../lib/pyclient";
import type { QuoteData } from "../lib/quote-assemble";

const LANGUAGE_NAME: Record<Language, string> = {
  en: "English",
  es: "Spanish (Español)",
  pt: "Portuguese (Português)",
};

/** The JSON schema description embedded in every prompt. */
const SCHEMA_BLOCK = `Return ONLY a single JSON object (no markdown fences, no prose before or after) with EXACTLY this shape:
{
  "summary": string,            // 1-2 sentence scope summary
  "coverNote": string,          // warm, professional cover letter (2-4 short paragraphs)
  "lineItems": [
    {
      "name": string,
      "description": string,    // one concise sentence
      "quantity": number,       // positive integer
      "unit": string,           // e.g. "page", "hour", "project", "month", "item"
      "unitPriceCents": number, // INTEGER cents in the quote currency
      "catalogItemId": string | null  // the matched item's id, or null if you added it
    }
  ],
  "timeline": [ { "phase": string, "duration": string } ],   // 2-5 realistic phases
  "assumptions": [ string ],    // 3-6 realistic assumptions
  "terms": [ string ]           // 3-6 realistic commercial terms
}`;

function constraintsLine(matched: MatchResult): string {
  const c = matched.constraints;
  const parts: string[] = [];
  if (c.budgetCents != null) {
    parts.push(`budget ≈ ${(c.budgetCents / 100).toFixed(2)} ${matched.fx.target}`);
  }
  if (c.timelineText) parts.push(`timeline mentioned: "${c.timelineText}"`);
  if (c.keywords.length) parts.push(`keywords: ${c.keywords.join(", ")}`);
  return parts.length ? parts.join("; ") : "none detected";
}

function matchedItemsBlock(matched: MatchResult): string {
  if (!matched.rankedItems.length) {
    return "(no matched catalog items — invent reasonable, fairly-priced line items)";
  }
  const lines = matched.rankedItems.map((it) => {
    const price = (it.unitPriceCents / 100).toFixed(2);
    return `- id=${it.catalogItemId} | "${it.name}" | category=${it.category} | unit=${it.unit} | unitPrice=${it.unitPriceCents} cents (${price} ${matched.fx.target}) | suggestedQty=${it.suggestedQty} | relevance=${it.score}`;
  });
  return lines.join("\n");
}

const COMMON_RULES = (language: Language, currency: string): string =>
  `RULES:
- Write ALL human-readable text (summary, coverNote, line item names/descriptions, timeline, assumptions, terms) in ${LANGUAGE_NAME[language]}. Do NOT use any other language.
- All "unitPriceCents" values are INTEGER cents in ${currency}. Use the matched items' unit prices as your price reference; you may set sensible quantities and add a few reasonable extra items, but keep prices realistic for ${currency}.
- Prefer matched catalog items where they fit the request; set "catalogItemId" to that item's id. For items you add yourself, set "catalogItemId" to null.
- Do NOT compute totals, subtotals, tax, or discounts — only provide per-line "unitPriceCents" and "quantity". The system computes all sums.
- Keep the tone warm and professional, as if writing to a prospective client.
${SCHEMA_BLOCK}`;

/** Build the prompt for a fresh generation. */
export function buildGeneratePrompt(args: GenerateArgs): string {
  const { requestText, language, currency, matched } = args;
  return `You are an expert proposal writer for a professional services agency. A prospective client has sent a plain-language request. Produce a polished, itemized proposal as a JSON object.

CLIENT REQUEST:
"""
${requestText}
"""

TARGET LANGUAGE: ${LANGUAGE_NAME[language]}
QUOTE CURRENCY: ${currency}
DETECTED CONSTRAINTS: ${constraintsLine(matched)}

MATCHED CATALOG ITEMS (allowed price reference; prices already in ${currency}):
${matchedItemsBlock(matched)}

${COMMON_RULES(language, currency)}`;
}

/** Summarize the current quote compactly so the model can revise it. */
function currentQuoteSummary(current: QuoteData): string {
  const items = current.lineItems
    .map(
      (li) =>
        `  - "${li.name}" qty=${li.quantity} ${li.unit} @ ${li.unitPriceCents} cents${
          li.catalogItemId ? ` (catalogItemId=${li.catalogItemId})` : ""
        }`
    )
    .join("\n");
  return `summary: ${current.summary}
coverNote: ${current.coverNote}
lineItems:
${items || "  (none)"}
timeline: ${current.timeline.map((p) => `${p.phase} (${p.duration})`).join("; ") || "(none)"}
assumptions: ${current.assumptions.join(" | ") || "(none)"}
terms: ${current.terms.join(" | ") || "(none)"}`;
}

function historyBlock(history: RefineArgs["history"]): string {
  if (!history.length) return "(no prior chat)";
  return history
    .map((h) => `${h.role === "user" ? "Client" : "You"}: ${h.content}`)
    .join("\n");
}

/** Build the prompt for refining an existing quote. */
export function buildRefinePrompt(args: RefineArgs): string {
  const { current, history, instruction, language, currency, matched } = args;
  return `You are an expert proposal writer revising an EXISTING proposal based on a new instruction from the client. Return the FULL updated proposal as a JSON object (not a diff).

CURRENT PROPOSAL:
"""
${currentQuoteSummary(current)}
"""

CONVERSATION SO FAR:
${historyBlock(history)}

NEW INSTRUCTION FROM CLIENT:
"""
${instruction}
"""

TARGET LANGUAGE: ${LANGUAGE_NAME[language]}
QUOTE CURRENCY: ${currency}
DETECTED CONSTRAINTS: ${constraintsLine(matched)}

MATCHED CATALOG ITEMS (allowed price reference; prices already in ${currency}):
${matchedItemsBlock(matched)}

Apply the instruction faithfully while keeping the rest of the proposal coherent.
${COMMON_RULES(language, currency)}`;
}
