import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/server/errors";
import { requireUser } from "@/server/auth";
import { disableMfa } from "@/server/mfa";

const schema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

/** Disabling requires a current valid code. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json().catch(() => {
      throw new ApiError(400, "Invalid request body.");
    });
    const { code } = schema.parse(json);
    await disableMfa(user.uid, code);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
