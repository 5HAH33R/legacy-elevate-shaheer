import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** HTTP error with a safe, user-readable message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Convert any thrown error into a safe JSON response. Never leaks stack
 * traces or raw provider errors to the client (AGENTS.md section 13).
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error("Unexpected server error:", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
