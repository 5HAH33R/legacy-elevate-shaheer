import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  archiveSupplierForBusiness,
  getSupplierForBusiness,
  updateSupplierForBusiness,
  updateSupplierSchema,
} from "@/server/suppliers";

type RouteContext = {
  params: Promise<{ businessId: string; supplierId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, supplierId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    return NextResponse.json({
      supplier: await getSupplierForBusiness(businessId, supplierId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, supplierId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = updateSupplierSchema.parse(json ?? {});
    const supplier = await updateSupplierForBusiness(businessId, supplierId, input);
    return NextResponse.json({ supplier });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Archives the supplier (never hard-deletes). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, supplierId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    await archiveSupplierForBusiness(businessId, supplierId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
