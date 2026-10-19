import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  createExpenseForBusiness,
  createExpenseSchema,
  listExpensesForBusiness,
} from "@/server/expenses";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ businessId: string }> };

/** List recorded expenses for the owner's business. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const expenses = await listExpensesForBusiness(businessId);
    return NextResponse.json({ expenses });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Record an expense. businessId comes from the verified URL, never the body. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = createExpenseSchema.parse(json ?? {});
    const expense = await createExpenseForBusiness(businessId, input);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
