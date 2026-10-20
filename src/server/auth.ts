import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
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
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // With cacheComponents + partialPrefetching, cookies() reads happen during
  // the App Shell prerender and Firebase verification reads the current time
  // (an unstable value). connection() opts out of prerendering so the session
  // is verified fresh on every request instead.
  await connection();
  const store = await cookies();
  // verifySessionUser keeps the revocation check (verifySessionCookie(c, true)).
  return verifySessionUser(store.get(SESSION_COOKIE_NAME)?.value);
});

/**
 * Verified signed-in user for API route handlers. Throws ApiError(401) when
 * unauthenticated; wrap handlers in errorResponse().
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "You must be signed in.");
  return user;
}
