import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  adjustStockForBusiness,
  adjustStockSchema,
  listMovementsForProduct,
} from "@/server/inventory";
import { getProductForBusiness } from "@/server/products";

type RouteContext = {
  params: Promise<{ businessId: string; productId: string }>;
};

/** Movement history for a product. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, productId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    await getProductForBusiness(businessId, productId);
    const movements = await listMovementsForProduct(businessId, productId);
    return NextResponse.json({ movements });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Adjust stock by a signed amount; a reason is mandatory. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, productId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = adjustStockSchema.parse(json ?? {});
    await adjustStockForBusiness(businessId, productId, input, user.uid);
    const product = await getProductForBusiness(businessId, productId);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
