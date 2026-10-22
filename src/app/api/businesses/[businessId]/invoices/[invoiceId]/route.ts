import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { discardInvoiceForBusiness, getInvoiceForBusiness } from "@/server/invoices";

type RouteContext = { params: Promise<{ businessId: string; invoiceId: string }> };

/** One scanned invoice and what was read from it. Another business's → 404. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, invoiceId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const invoice = await getInvoiceForBusiness(businessId, invoiceId);
    return NextResponse.json({ invoice });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Discard an unconfirmed scan (kept as "discarded"; no records change). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, invoiceId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const invoice = await discardInvoiceForBusiness(businessId, invoiceId);
    return NextResponse.json({ invoice });
  } catch (error) {
    return errorResponse(error);
  }
}
