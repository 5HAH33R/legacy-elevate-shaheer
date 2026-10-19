import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  createSaleSchema,
  listSalesForBusiness,
  recordSaleForBusiness,
} from "@/server/sales";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ businessId: string }> };

/** List confirmed sales for the owner's business. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const sales = await listSalesForBusiness(businessId);
    return NextResponse.json({ sales });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Record a sale and deduct stock atomically. The client-generated saleId
 * makes the request idempotent: a retry returns the existing sale with 200
 * instead of deducting stock twice.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = createSaleSchema.parse(json ?? {});
    const result = await recordSaleForBusiness(businessId, input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
