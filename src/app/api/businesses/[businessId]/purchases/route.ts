import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  createPurchaseSchema,
  listPurchasesForBusiness,
  recordPurchaseForBusiness,
} from "@/server/purchases";

type RouteContext = { params: Promise<{ businessId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const q = new URL(request.url).searchParams;
    const purchases = await listPurchasesForBusiness(businessId, {
      from: q.get("from") || undefined,
      to: q.get("to") || undefined,
      supplierId: q.get("supplierId") || undefined,
    });
    return NextResponse.json({ purchases });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Idempotent on purchaseId: a retry returns the existing purchase (200). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = createPurchaseSchema.parse(json ?? {});
    const result = await recordPurchaseForBusiness(
      businessId,
      input,
      user.uid,
      business.timezone,
    );
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
