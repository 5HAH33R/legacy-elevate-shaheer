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
