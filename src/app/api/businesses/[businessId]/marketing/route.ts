import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { generateMarketing, marketingSchema } from "@/server/ai/marketing";

type RouteContext = { params: Promise<{ businessId: string }> };

/** Generate read-only marketing suggestions. Never posts or spends anything. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const body = marketingSchema.parse((await request.json().catch(() => null)) ?? {});
    const result = await generateMarketing({ uid: user.uid, business, request: body });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
