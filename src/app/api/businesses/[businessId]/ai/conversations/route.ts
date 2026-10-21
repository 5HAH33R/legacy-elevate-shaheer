import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { listConversationsForOwner } from "@/server/ai/conversations";

type RouteContext = { params: Promise<{ businessId: string }> };

/** The signed-in owner's saved assistant conversations for this business. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const conversations = await listConversationsForOwner(businessId, user.uid);
    return NextResponse.json({ conversations });
  } catch (error) {
    return errorResponse(error);
  }
}
