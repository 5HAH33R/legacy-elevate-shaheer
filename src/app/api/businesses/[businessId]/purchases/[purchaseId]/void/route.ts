import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { voidPurchaseForBusiness } from "@/server/purchases";

type RouteContext = {
  params: Promise<{ businessId: string; purchaseId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, purchaseId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    await voidPurchaseForBusiness(businessId, purchaseId, user.uid);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
