import "server-only";

import { z } from "zod";

/**
 * Server-only environment variables. Never prefix these with NEXT_PUBLIC_.
 * Validated on first use so a missing secret fails loudly on the server
 * instead of leaking into a partial response.
 */
const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.email(),
  // Hosting dashboards often store the key with literal "\n" sequences.
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((key) => key.replace(/\\n/g, "\n")),
  FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    // Report variable names only, never their values.
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `Invalid server environment (check: ${names.join(", ")}). See .env.example.`,
    );
  }
  cached = result.data;
  return cached;
}

/**
 * AI assistant settings (SPEC 8.1). Optional: without AI_API_KEY the
 * assistant reports "not configured" instead of failing the whole app, and
 * never falls back to a fake answer (AGENTS.md section 5).
 */
const aiEnvSchema = z.object({
  AI_PROVIDER: z.enum(["gemini"]).default("gemini"),
  AI_API_KEY: z.string().trim().min(1),
  AI_MODEL: z.string().trim().min(1).default("gemini-3.5-flash-lite"),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(30),
});

export type AiConfig = z.infer<typeof aiEnvSchema>;

/** Read on every call (cheap) so tests and key rotation need no restart. */
export function getAiConfig(): AiConfig | null {
  const blankToUndefined = (value: string | undefined) =>
    value === undefined || value.trim() === "" ? undefined : value;
  const result = aiEnvSchema.safeParse({
    AI_PROVIDER: blankToUndefined(process.env.AI_PROVIDER),
    AI_API_KEY: blankToUndefined(process.env.AI_API_KEY),
    AI_MODEL: blankToUndefined(process.env.AI_MODEL),
    AI_DAILY_LIMIT: blankToUndefined(process.env.AI_DAILY_LIMIT),
  });
  if (!result.success) {
    if (process.env.AI_API_KEY) {
      // A key is set but another AI_* value is invalid: name it, never values.
      const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
      console.error(`Invalid AI configuration (check: ${names.join(", ")}).`);
    }
    return null;
  }
  return result.data;
}
