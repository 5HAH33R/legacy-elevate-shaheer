import "server-only";

import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { MinorUnits } from "@/lib/money";
import { dateField, moneyField } from "@/lib/validation";
import { ApiError } from "./errors";
import { toIso, toNullableString, toNumber } from "./serialize";

export const createExpenseSchema = z.object({
  date: dateField,
  category: z.string().trim().min(1, "Category is required.").max(60),
  description: z.string().trim().max(240).optional(),
  amount: moneyField("Amount"),
});

export type CreateExpenseInput = z.output<typeof createExpenseSchema>;

/** SPEC.md 9.5. */
export type Expense = {
  expenseId: string;
  businessId: string;
  date: string;
  category: string;
  description: string | null;
  amount: MinorUnits;
  createdAt: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

function serializeExpense(id: string, data: DocumentData): Expense {
  return {
    expenseId: id,
    businessId: String(data.businessId ?? ""),
    date: String(data.date ?? ""),
    category: String(data.category ?? ""),
    description: toNullableString(data.description),
    amount: toNumber(data.amount),
    createdAt: toIso(data.createdAt),
    // A voided doc always counts as voided even if the timestamp is pending.
    voidedAt: data.voidedAt
      ? (toIso(data.voidedAt) ?? new Date(0).toISOString())
      : null,
    voidedBy: toNullableString(data.voidedBy),
    voidReason: toNullableString(data.voidReason),
  };
}

/** Single-field query (no composite index); newest date first, in memory. */
export async function listExpensesForBusiness(
  businessId: string,
  db: Firestore = getAdminDb(),
): Promise<Expense[]> {
  const snapshot = await db
    .collection("expenses")
    .where("businessId", "==", businessId)
    .get();
  return snapshot.docs
    .map((doc) => serializeExpense(doc.id, doc.data()))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createExpenseForBusiness(
  businessId: string,
  input: CreateExpenseInput,
  db: Firestore = getAdminDb(),
): Promise<Expense> {
  const ref = db.collection("expenses").doc();
  await ref.set({
    businessId,
    date: input.date,
    category: input.category,
    description: input.description ?? null,
    amount: input.amount,
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    expenseId: ref.id,
    businessId,
    date: input.date,
    category: input.category,
    description: input.description ?? null,
    amount: input.amount,
    createdAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
  };
}

/** Expenses that still count toward totals. */
export function activeExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => e.voidedAt === null);
}

/**
 * Void (never erase) an expense that belongs to the business; 404 otherwise.
 * Voiding twice keeps the original voidedAt/voidedBy.
 */
export async function voidExpenseForBusiness(
  businessId: string,
  expenseId: string,
  actorId: string | null,
  voidReason?: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  const ref = db.collection("expenses").doc(expenseId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.businessId !== businessId) {
    throw new ApiError(404, "Expense not found.");
  }
  if (data.voidedAt) return;
  await ref.update({
    voidedAt: FieldValue.serverTimestamp(),
    voidedBy: actorId,
    voidReason: voidReason?.trim() ? voidReason.trim().slice(0, 240) : null,
  });
}
