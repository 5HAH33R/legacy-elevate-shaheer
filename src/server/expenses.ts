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
  };
}

/** Delete only when the expense belongs to the business; 404 otherwise. */
export async function deleteExpenseForBusiness(
  businessId: string,
  expenseId: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  const ref = db.collection("expenses").doc(expenseId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.businessId !== businessId) {
    throw new ApiError(404, "Expense not found.");
  }
  await ref.delete();
}
