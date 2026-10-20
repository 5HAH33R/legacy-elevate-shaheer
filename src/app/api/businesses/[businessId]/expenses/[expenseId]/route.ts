import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { voidExpenseForBusiness } from "@/server/expenses";

type RouteContext = {
  params: Promise<{ businessId: string; expenseId: string }>;
};

/**
 * "Delete" now voids the expense (voidedAt/voidedBy/voidReason); the record
 * is kept for audit. Optional JSON body: { reason }. Others get 404.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, expenseId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = (await request.json().catch(() => null)) as {
      reason?: unknown;
    } | null;
    const reason = typeof json?.reason === "string" ? json.reason : undefined;
    await voidExpenseForBusiness(businessId, expenseId, user.uid, reason);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
