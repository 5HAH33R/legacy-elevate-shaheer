import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "__elevate_session";
/** Firebase session cookies allow up to 14 days; 5 days keeps re-auth fresh. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** The verified, server-trusted identity for the current request. */
export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  /** Custom claim, set only by scripts/set-admin-claim.mjs. */
  platformAdmin: boolean;
};

/** Cookie attributes. Not "__Host-"-prefixed so local http dev still works. */
export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
  };
}

/** Exchange a verified client ID token for a long-lived session cookie. */
export async function createSessionCookie(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

/**
 * Verify a session cookie and return the signed-in user, or null when the
 * cookie is missing, expired or revoked. The revocation check means a user
 * stays signed out everywhere after sign-out or a password change.
 */
export async function verifySessionUser(
  cookieValue: string | undefined,
): Promise<SessionUser | null> {
  if (!cookieValue) return null;
  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifySessionCookie(cookieValue, true);
  } catch {
    return null;
  }
  return toSessionUser(decoded);
}

export function toSessionUser(decoded: DecodedIdToken): SessionUser {
  const claims = decoded as DecodedIdToken & Record<string, unknown>;
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: decoded.name ?? null,
    platformAdmin: claims.platformAdmin === true,
  };
}
