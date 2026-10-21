import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { askAssistant } from "@/server/ai/assistant";
import { chatRequestSchema } from "@/server/ai/conversations";

type RouteContext = { params: Promise<{ businessId: string }> };

/**
 * Ask the business assistant. Identity and ownership are verified before any
 * business data is read or the AI provider is called; the answer is saved to
 * the owner's conversation and returned. Body: { question, conversationId? }.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const json = await request.json().catch(() => null);
    const input = chatRequestSchema.parse(json ?? {});
    const conversation = await askAssistant({ uid: user.uid, business, request: input });
    return NextResponse.json({ conversation });
  } catch (error) {
    return errorResponse(error);
  }
}
