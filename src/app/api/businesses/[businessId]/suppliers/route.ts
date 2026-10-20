import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  createSupplierSchema,
  createSupplierForBusiness,
  listSuppliersForBusiness,
} from "@/server/suppliers";

type RouteContext = { params: Promise<{ businessId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const all = new URL(request.url).searchParams.get("includeArchived") === "1";
    const suppliers = await listSuppliersForBusiness(businessId, all);
    return NextResponse.json({ suppliers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = createSupplierSchema.parse(json ?? {});
    const supplier = await createSupplierForBusiness(businessId, input);
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
