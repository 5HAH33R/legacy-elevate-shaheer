import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listExpensesForBusiness, type Expense } from "@/server/expenses";
import { formatMoney } from "@/lib/money";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { DeleteExpenseButton } from "@/features/expenses/delete-expense-button";

export const metadata: Metadata = { title: "Expenses — Elevate" };

function ExpenseList({
  businessId,
  expenses,
  currency,
}: {
  businessId: string;
  expenses: Expense[];
  currency: string;
}) {
  if (expenses.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        No expenses recorded yet. Recording all costs keeps your profit figures
        honest.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Description</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.expenseId} className="border-t border-border">
              <td className="px-4 py-3">{expense.date}</td>
              <td className="px-4 py-3 font-medium">{expense.category}</td>
              <td className="px-4 py-3 text-muted">
                {expense.description ?? "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMoney(expense.amount, currency)}
              </td>
              <td className="px-4 py-3">
                <DeleteExpenseButton
                  businessId={businessId}
                  expenseId={expense.expenseId}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ExpensesContent({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  const expenses = await listExpensesForBusiness(businessId);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name} — Expenses
        </h1>
        <p className="mt-1 text-sm text-muted">
          Rent, utilities and other costs. Stock purchases are handled
          separately in a later phase.
        </p>
      </section>

      <BusinessNav businessId={businessId} />
      <ExpenseForm businessId={businessId} currency={business.currency} />
      <ExpenseList
        businessId={businessId}
        expenses={expenses}
        currency={business.currency}
      />
    </div>
  );
}

export default function ExpensesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <ExpensesContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
