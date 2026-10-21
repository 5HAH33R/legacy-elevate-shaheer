import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import {
  deleteConversationForOwner,
  getConversationForOwner,
} from "@/server/ai/conversations";

type RouteContext = {
  params: Promise<{ businessId: string; conversationId: string }>;
};

/** One saved conversation. Someone else's (or another business's) → 404. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, conversationId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    const conversation = await getConversationForOwner(businessId, user.uid, conversationId);
    return NextResponse.json({ conversation });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Permanently delete the owner's conversation (chat history, not business records). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId, conversationId } = await context.params;
    await requireBusinessOwner(user.uid, businessId);
    await deleteConversationForOwner(businessId, user.uid, conversationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
