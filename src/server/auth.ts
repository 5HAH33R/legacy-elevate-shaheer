import "server-only";

import { cookies } from "next/headers";
import { ApiError } from "./errors";
import {
  SESSION_COOKIE_NAME,
  verifySessionUser,
  type SessionUser,
} from "./session";

/**
 * The verified signed-in user for the current request, or null. Identity
 * comes only from the httpOnly session cookie — never from a client-sent UID.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionUser(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * Verified signed-in user for API route handlers. Throws ApiError(401) when
 * unauthenticated; wrap handlers in errorResponse().
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "You must be signed in.");
  return user;
}
