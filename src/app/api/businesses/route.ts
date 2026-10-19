import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import {
  createBusinessForUser,
  createBusinessSchema,
  listBusinessesForUser,
} from "@/server/businesses";
import { errorResponse } from "@/server/errors";

export const runtime = "nodejs";

/** List the signed-in owner's businesses. */
export async function GET() {
  try {
    const user = await requireUser();
    const businesses = await listBusinessesForUser(user.uid);
    return NextResponse.json({ businesses });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Create a business workspace (onboarding). ownerId always comes from the
 * verified session — a client-sent ownerId is ignored by the schema.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json().catch(() => null);
    const input = createBusinessSchema.parse(json ?? {});
    const business = await createBusinessForUser(user.uid, input);
    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
