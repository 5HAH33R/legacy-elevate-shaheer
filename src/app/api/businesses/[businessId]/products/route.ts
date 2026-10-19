import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  createProductForBusiness,
  createProductSchema,
  listProductsForBusiness,
} from "@/server/products";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ businessId: string }> };

/** List products. Ownership is verified first; others get 404. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const products = await listProductsForBusiness(businessId);
    return NextResponse.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Create a product. businessId comes from the verified URL, never the body. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = createProductSchema.parse(json ?? {});
    const product = await createProductForBusiness(businessId, input);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
