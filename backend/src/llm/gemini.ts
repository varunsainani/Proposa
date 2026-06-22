/**
 * Gemini provider (ACTIVE default, SPEC §7).
 *
 * POST https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent
 * header: X-goog-api-key: ${GEMINI_API_KEY}
 * body:   { contents:[{parts:[{text:PROMPT}]}],
 *           generationConfig:{ responseMimeType:"application/json", temperature:0.4 } }
 * Read candidates[0].content.parts[0].text and JSON.parse it.
 *
 * Throws AppError(LLM_ERROR) on HTTP / parse failure (the caller in llm/index.ts
 * retries once, then falls back to a deterministic draft — never 500s the user).
 */

import { env } from "../lib/env";
import { llmError } from "../lib/errors";
import { buildGeneratePrompt, buildRefinePrompt } from "./prompt";
import type {
  GenerateArgs,
  LLMProvider,
  LLMQuoteDraft,
  RefineArgs,
} from "./types";

const TIMEOUT_MS = 30_000;

/**
 * Extract a JSON object from a model text response. Tolerates accidental
 * markdown fences or leading/trailing prose by slicing to the outermost braces.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = (text || "").trim();
  // Fast path: already pure JSON.
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to brace-slicing */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON object found in model output");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callGemini(prompt: string): Promise<LLMQuoteDraft> {
  if (!env.GEMINI_API_KEY) {
    throw llmError("error.llm", undefined, "GEMINI_API_KEY not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "gemini.fetch",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw llmError("error.llm", undefined, {
      where: "gemini.http",
      status: res.status,
      body: body.slice(0, 500),
    });
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "gemini.json",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const text =
    (payload as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text || typeof text !== "string") {
    throw llmError("error.llm", undefined, {
      where: "gemini.empty",
      detail: "no text in candidates[0].content.parts[0].text",
    });
  }

  try {
    return extractJsonObject(text) as LLMQuoteDraft;
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "gemini.parse",
      message: err instanceof Error ? err.message : String(err),
      sample: text.slice(0, 300),
    });
  }
}

export const geminiProvider: LLMProvider = {
  name: env.GEMINI_MODEL,
  generateQuote(args: GenerateArgs): Promise<LLMQuoteDraft> {
    return callGemini(buildGeneratePrompt(args));
  },
  refineQuote(args: RefineArgs): Promise<LLMQuoteDraft> {
    return callGemini(buildRefinePrompt(args));
  },
};
