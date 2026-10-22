import { NextResponse } from "next/server";
import { errorResponse, ApiError } from "@/server/errors";
import { requireUser } from "@/server/auth";
import { startSetup } from "@/server/mfa";

/** Generate a pending TOTP secret for the signed-in user (stored encrypted). */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user.email) throw new ApiError(400, "Your account has no email address.");
    const { secret, uri } = await startSetup(user.uid, user.email);
    return NextResponse.json({ secret, uri });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Current 2FA status for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    const { isMfaEnabled } = await import("@/server/mfa");
    return NextResponse.json({ enabled: await isMfaEnabled(user.uid) });
  } catch (error) {
    return errorResponse(error);
  }
}
