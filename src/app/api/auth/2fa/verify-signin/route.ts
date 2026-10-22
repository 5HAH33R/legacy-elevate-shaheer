import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ApiError, errorResponse } from "@/server/errors";
import { verifySignInCode, verifyTempToken } from "@/server/mfa";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  sessionCookieOptions,
} from "@/server/session";

const schema = z.object({
  tempToken: z.string().min(1),
  idToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

/** Second sign-in step: temp token + ID token + TOTP code -> session cookie. */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => {
      throw new ApiError(400, "Invalid request body.");
    });
    const { tempToken, idToken, code } = schema.parse(json);
    const uid = verifyTempToken(tempToken);
    const decoded = await getAdminAuth()
      .verifyIdToken(idToken)
      .catch(() => {
        throw new ApiError(401, "This sign-in expired. Go back and sign in again.");
      });
    if (decoded.uid !== uid) {
      throw new ApiError(401, "This sign-in expired. Go back and sign in again.");
    }
    await verifySignInCode(uid, code);

    const sessionCookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions(SESSION_MAX_AGE_MS));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
