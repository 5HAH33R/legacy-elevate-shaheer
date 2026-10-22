import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { confirmInvoiceForBusiness, confirmInvoiceSchema } from "@/server/invoices";

type RouteContext = { params: Promise<{ businessId: string; invoiceId: string }> };

/**
 * Confirm the reviewed invoice: records it as a purchase (stock goes up).
 * Body: { purchaseId, supplierId | newSupplierName, date, items[] }.
 * Idempotent on purchaseId.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, invoiceId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const data = confirmInvoiceSchema.parse(json ?? {});
    const result = await confirmInvoiceForBusiness({ business, uid: user.uid, invoiceId, data });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
