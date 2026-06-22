/**
 * Anthropic provider (switchable, SPEC §7). Used only when
 * LLM_PROVIDER=anthropic AND ANTHROPIC_API_KEY is set.
 *
 * Messages API: POST https://api.anthropic.com/v1/messages
 *   headers: x-api-key, anthropic-version: 2023-06-01, content-type
 *   model:   ANTHROPIC_MODEL (default claude-sonnet-4-6)
 * We ask for JSON-only output and parse content[0].text. Sonnet 4.6 supports a
 * temperature and adaptive thinking; we keep a modest temperature for stable,
 * structured output and parse defensively.
 *
 * Throws AppError(LLM_ERROR) on HTTP / parse failure; llm/index.ts handles retry
 * + deterministic fallback so the user never sees a 500.
 */

import { env } from "../lib/env";
import { llmError } from "../lib/errors";
import { extractJsonObject } from "./gemini";
import { buildGeneratePrompt, buildRefinePrompt } from "./prompt";
import type {
  GenerateArgs,
  LLMProvider,
  LLMQuoteDraft,
  RefineArgs,
} from "./types";

const TIMEOUT_MS = 40_000;
const MAX_TOKENS = 8000;

const SYSTEM_PROMPT =
  "You are a proposal-writing assistant. You always respond with a single valid JSON object that matches the requested schema, and nothing else — no markdown code fences, no commentary.";

async function callAnthropic(prompt: string): Promise<LLMQuoteDraft> {
  if (!env.ANTHROPIC_API_KEY) {
    throw llmError("error.llm", undefined, "ANTHROPIC_API_KEY not set");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "anthropic.fetch",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw llmError("error.llm", undefined, {
      where: "anthropic.http",
      status: res.status,
      body: body.slice(0, 500),
    });
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "anthropic.json",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Messages API returns content: [{type:"text", text:"..."}]. Concatenate all
  // text blocks defensively.
  const blocks: any[] = Array.isArray((payload as any)?.content)
    ? (payload as any).content
    : [];
  const text = blocks
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");

  if (!text) {
    throw llmError("error.llm", undefined, {
      where: "anthropic.empty",
      detail: "no text block in content[]",
    });
  }

  try {
    return extractJsonObject(text) as LLMQuoteDraft;
  } catch (err) {
    throw llmError("error.llm", undefined, {
      where: "anthropic.parse",
      message: err instanceof Error ? err.message : String(err),
      sample: text.slice(0, 300),
    });
  }
}

export const anthropicProvider: LLMProvider = {
  name: env.ANTHROPIC_MODEL,
  generateQuote(args: GenerateArgs): Promise<LLMQuoteDraft> {
    return callAnthropic(buildGeneratePrompt(args));
  },
  refineQuote(args: RefineArgs): Promise<LLMQuoteDraft> {
    return callAnthropic(buildRefinePrompt(args));
  },
};
