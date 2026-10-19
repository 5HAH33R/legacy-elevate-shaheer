import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import {
  requireBusinessOwner,
  updateBusinessForOwner,
  updateBusinessSchema,
} from "@/server/businesses";
import { errorResponse } from "@/server/errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ businessId: string }> };

/** Read one business. Only its owner can; everyone else gets 404. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    return NextResponse.json({ business });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Update name/businessType/currency. Ownership is checked first. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const json = await request.json().catch(() => null);
    const input = updateBusinessSchema.parse(json ?? {});
    const business = await updateBusinessForOwner(user.uid, businessId, input);
    return NextResponse.json({ business });
  } catch (error) {
    return errorResponse(error);
  }
}
