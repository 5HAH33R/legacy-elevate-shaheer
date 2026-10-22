import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ApiError, errorResponse } from "@/server/errors";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  sessionCookieOptions,
  toSessionUser,
} from "@/server/session";
import { ensureUserRecord } from "@/server/users";
import { isMfaEnabled, signTempToken } from "@/server/mfa";

const bodySchema = z.object({ idToken: z.string().min(1) });

/**
 * Sign-in bridge: the client signs in with Firebase Auth, then exchanges its
 * short-lived ID token for an httpOnly session cookie the server can verify.
 * Also creates users/{uid} on first sign-in (SPEC.md 9.1).
 */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => {
      throw new ApiError(400, "Invalid request body.");
    });
    const { idToken } = bodySchema.parse(json);

    // Verify the ID token before trusting anything about this sign-in.
    const decoded = await getAdminAuth()
      .verifyIdToken(idToken)
      .catch(() => {
        throw new ApiError(401, "Sign-in could not be verified. Please try again.");
      });

    const user = toSessionUser(decoded);
    await ensureUserRecord(user);

    // 2FA enabled: no cookie until the TOTP code is verified.
    if (await isMfaEnabled(user.uid)) {
      return NextResponse.json({ mfaRequired: true, tempToken: signTempToken(user.uid) });
    }

    const sessionCookie = await createSessionCookie(idToken);

    const response = NextResponse.json({
      ok: true,
      user: { uid: user.uid, email: user.email, name: user.name },
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      sessionCookieOptions(SESSION_MAX_AGE_MS),
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Sign-out: revoke refresh tokens (invalidates all existing sessions for the
 * user) and clear the cookie. Always succeeds, even with an expired cookie.
 */
export async function DELETE() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (value) {
    try {
      const decoded = await getAdminAuth().verifySessionCookie(value);
      await getAdminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Expired or invalid cookie: clearing it is enough.
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
  return response;
}
