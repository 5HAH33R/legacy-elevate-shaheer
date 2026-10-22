import { NextResponse } from "next/server";
import { parseInvoiceType } from "@/lib/invoices";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { ApiError, errorResponse } from "@/server/errors";
import { listInvoicesForBusiness, scanInvoiceForBusiness } from "@/server/invoices";

type RouteContext = { params: Promise<{ businessId: string }> };

/** The owner's scanned invoices, newest first. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const invoices = await listInvoicesForBusiness(businessId);
    return NextResponse.json({ invoices });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Upload one invoice (multipart field "file"). Ownership is checked before
 * the file is read or sent to the AI service. The file itself is not stored.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose an invoice file to upload.");
    // Absent field = purchase (legacy clients); a present but invalid value is rejected.
    const typeField = form?.get("invoiceType");
    const invoiceType = typeField === null || typeField === undefined ? "purchase" : parseInvoiceType(typeField);
    if (!invoiceType) throw new ApiError(400, "Invoice type must be purchase or sale.");
    const invoice = await scanInvoiceForBusiness({
      invoiceType,
      uid: user.uid,
      business,
      fileName: file.name,
      declaredType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
