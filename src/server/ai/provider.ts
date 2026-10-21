import "server-only";

import { z } from "zod";
import type { AiConfig } from "@/lib/env/server";

/**
 * Hosted-model adapter (SPEC 8.1). The only file that talks to the AI
 * provider; everything else uses generateAnswer(). Plain fetch against the
 * Gemini REST API (no SDK dependency). The API key stays on the server and
 * is never logged; provider error bodies are never passed to the client.
 */
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type AiAnswer = {
  text: string;
  model: string;
  /** True when the model hit the output limit and the answer may be cut off. */
  truncated: boolean;
  usage: { inputTokens: number; outputTokens: number } | null;
};

export type AiErrorKind = "rate-limited" | "blocked" | "unavailable" | "invalid-response";

/** Safe, user-readable failure. `kind` drives the HTTP status in the route. */
export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    /** Worth one retry (provider 5xx). */
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const REQUEST_TIMEOUT_MS = 25_000;
// Thinking models spend part of this budget on reasoning before the answer.
const MAX_OUTPUT_TOKENS = 2048;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

const BLOCKED_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

type FetchLike = typeof fetch;

async function callGemini(
  config: AiConfig,
  system: string,
  turns: readonly ChatTurn[],
  fetchImpl: FetchLike,
): Promise<AiAnswer> {
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(config.AI_MODEL)}:generateContent`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.AI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.text }],
      })),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Status only: the body can echo request content.
    console.error(`AI provider returned HTTP ${response.status}.`);
    if (response.status === 429) {
      throw new AiError(
        "rate-limited",
        "The AI service is busy or its free quota is used up. Please try again later.",
      );
    }
    if (response.status >= 500) {
      throw new AiError("unavailable", "The AI service is temporarily unavailable. Please try again.", true);
    }
    throw new AiError("unavailable", "The AI service could not process this request.");
  }

  const parsed = geminiResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AiError("invalid-response", "The AI service returned an unexpected response.");
  }
  const data = parsed.data;
  if (data.promptFeedback?.blockReason) {
    throw new AiError("blocked", "The AI service declined to answer this question. Try rephrasing it.");
  }
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    if (candidate?.finishReason && BLOCKED_REASONS.has(candidate.finishReason)) {
      throw new AiError("blocked", "The AI service declined to answer this question. Try rephrasing it.");
    }
    throw new AiError("invalid-response", "The AI service returned an empty answer. Please try again.");
  }
  return {
    text,
    model: config.AI_MODEL,
    truncated: candidate?.finishReason === "MAX_TOKENS",
    usage: data.usageMetadata
      ? {
          inputTokens: data.usageMetadata.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
        }
      : null,
  };
}

function isTransient(error: unknown): boolean {
  if (error instanceof AiError) return error.retryable;
  // fetch network failures and AbortSignal timeouts.
  return error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError");
}

/**
 * Ask the hosted model. Retries once on network errors, timeouts and 5xx;
 * never on quota, safety or bad-request errors.
 */
export async function generateAnswer(
  config: AiConfig,
  input: { system: string; turns: readonly ChatTurn[] },
  fetchImpl: FetchLike = fetch,
): Promise<AiAnswer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callGemini(config, input.system, input.turns, fetchImpl);
    } catch (error) {
      if (attempt < 2 && isTransient(error)) continue;
      if (error instanceof AiError) throw error;
      console.error("AI provider request failed:", error instanceof Error ? error.name : "unknown");
      throw new AiError("unavailable", "The AI service could not be reached. Please try again.");
    }
  }
}
