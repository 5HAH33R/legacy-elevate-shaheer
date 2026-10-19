import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { deleteExpenseForBusiness } from "@/server/expenses";

type RouteContext = {
  params: Promise<{ businessId: string; expenseId: string }>;
};

/** Delete a mis-entered expense. Others' businesses get 404. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, expenseId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    await deleteExpenseForBusiness(businessId, expenseId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
