import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { updateProductForBusiness, updateProductSchema } from "@/server/products";

type RouteContext = {
  params: Promise<{ businessId: string; productId: string }>;
};

/** Update a product. Business ownership is checked before the product loads. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, productId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = updateProductSchema.parse(json ?? {});
    const product = await updateProductForBusiness(businessId, productId, input);
    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
