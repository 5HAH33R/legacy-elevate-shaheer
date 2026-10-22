import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AssistantLanguage } from "@/lib/language";
import { ApiError } from "../errors";
import type { FigureSnapshot } from "./context";

/**
 * Saved assistant conversations (SPEC 9.9 `aiConversations`). Top-level
 * collection with businessId + ownerId; messages are an array on the
 * conversation document (capped), so one read loads a whole chat. Times are
 * ISO strings because Firestore server timestamps cannot live inside arrays.
 * Callers MUST have run requireBusinessOwner(uid, businessId) first; every
 * function here also checks the conversation's own businessId and ownerId.
 */
export const MAX_MESSAGES_PER_CONVERSATION = 40;
export const MAX_QUESTION_LENGTH = 1000;

export const chatRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Type a question first.")
    .max(MAX_QUESTION_LENGTH, `Keep questions under ${MAX_QUESTION_LENGTH} characters.`),
  conversationId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid conversation id.")
    .optional(),
});

export type ChatRequest = z.output<typeof chatRequestSchema>;

export type AssistantMessage = {
  messageId: string;
  role: "user" | "assistant";
  text: string;
  language: AssistantLanguage;
  createdAt: string;
  /** Assistant messages only. */
  model: string | null;
  truncated: boolean;
  snapshot: FigureSnapshot | null;
};

export type Conversation = {
  conversationId: string;
  businessId: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummary = Omit<Conversation, "messages" | "businessId"> & {
  messageCount: number;
};

const COLLECTION = "aiConversations";

function serializeMessage(raw: unknown): AssistantMessage {
  const m = (raw ?? {}) as Record<string, unknown>;
  const language = m.language === "ur" || m.language === "roman-ur" ? m.language : "en";
  return {
    messageId: String(m.messageId ?? ""),
    role: m.role === "assistant" ? "assistant" : "user",
    text: String(m.text ?? ""),
    language,
    createdAt: String(m.createdAt ?? ""),
    model: typeof m.model === "string" ? m.model : null,
    truncated: m.truncated === true,
    snapshot: m.snapshot && typeof m.snapshot === "object" ? (m.snapshot as FigureSnapshot) : null,
  };
}

function serializeConversation(id: string, data: DocumentData): Conversation {
  return {
    conversationId: id,
    businessId: String(data.businessId ?? ""),
    title: String(data.title ?? "Conversation"),
    messages: Array.isArray(data.messages) ? data.messages.map(serializeMessage) : [],
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

function titleFrom(question: string): string {
  const oneLine = question.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
}

/** The owner's conversations in this business, newest first. Single-field query. */
export async function listConversationsForOwner(
  businessId: string,
  uid: string,
  db: Firestore = getAdminDb(),
): Promise<ConversationSummary[]> {
  const snapshot = await db.collection(COLLECTION).where("businessId", "==", businessId).get();
  return snapshot.docs
    .filter((doc) => doc.data().ownerId === uid)
    .map((doc) => serializeConversation(doc.id, doc.data()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => ({
      conversationId: c.conversationId,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
}

/** 404 unless the conversation exists in this business and belongs to uid. */
export async function getConversationForOwner(
  businessId: string,
  uid: string,
  conversationId: string,
  db: Firestore = getAdminDb(),
): Promise<Conversation> {
  const snapshot = await db.collection(COLLECTION).doc(conversationId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.businessId !== businessId || data.ownerId !== uid) {
    throw new ApiError(404, "Conversation not found.");
  }
  return serializeConversation(snapshot.id, data);
}

export function assertConversationHasRoom(conversation: Conversation): void {
  if (conversation.messages.length + 2 > MAX_MESSAGES_PER_CONVERSATION) {
    throw new ApiError(409, "This conversation is full. Start a new conversation to keep asking.");
  }
}

/**
 * Save one question + answer. Creates the conversation when `existing` is
 * null. Only called after a successful model answer, so failed calls leave
 * no half-saved exchange.
 */
export async function saveExchange(
  input: {
    businessId: string;
    uid: string;
    existing: Conversation | null;
    question: AssistantMessage;
    answer: AssistantMessage;
  },
  db: Firestore = getAdminDb(),
): Promise<Conversation> {
  const now = input.answer.createdAt;
  if (input.existing) {
    const messages = [...input.existing.messages, input.question, input.answer];
    await db.collection(COLLECTION).doc(input.existing.conversationId).update({ messages, updatedAt: now });
    return { ...input.existing, messages, updatedAt: now };
  }
  const ref = db.collection(COLLECTION).doc();
  const conversation: Conversation = {
    conversationId: ref.id,
    businessId: input.businessId,
    title: titleFrom(input.question.text),
    messages: [input.question, input.answer],
    createdAt: input.question.createdAt,
    updatedAt: now,
  };
  await ref.set({
    businessId: input.businessId,
    ownerId: input.uid,
    title: conversation.title,
    messages: conversation.messages,
    createdAt: conversation.createdAt,
    updatedAt: now,
  });
  return conversation;
}

export async function deleteConversationForOwner(
  businessId: string,
  uid: string,
  conversationId: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  await getConversationForOwner(businessId, uid, conversationId, db);
  await db.collection(COLLECTION).doc(conversationId).delete();
}

/**
 * Per-user daily question limit, so one account cannot use up the free AI
 * quota (resets at the business's local midnight). Counted before the model
 * call; a failed call still counts, which keeps retries from bypassing it.
 */
export async function consumeDailyQuestion(
  uid: string,
  today: string,
  limit: number,
  db: Firestore = getAdminDb(),
): Promise<void> {
  await consumeDailyAiUse(uid, today, limit, "questions", db);
}

/**
 * The shared daily counter behind every AI feature. Each kind has its own
 * count (aiUsage/{uid}_{date} for questions, …_{kind} for the rest).
 */
export async function consumeDailyAiUse(
  uid: string,
  today: string,
  limit: number,
  kind: "questions" | "invoices",
  db: Firestore = getAdminDb(),
): Promise<void> {
  const id = kind === "questions" ? `${uid}_${today}` : `${uid}_${today}_${kind}`;
  const ref = db.collection("aiUsage").doc(id);
  const noun = kind === "questions" ? "assistant questions" : "invoice scans";
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const count = typeof snapshot.data()?.count === "number" ? (snapshot.data()?.count as number) : 0;
    if (count >= limit) {
      throw new ApiError(
        429,
        `You have reached today's limit of ${limit} ${noun}. Please try again tomorrow.`,
      );
    }
    tx.set(ref, { uid, date: today, kind, count: count + 1 });
  });
}
