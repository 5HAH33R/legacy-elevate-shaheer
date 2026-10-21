import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listExpensesForBusiness, type Expense } from "@/server/expenses";
import { formatMoney } from "@/lib/money";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { DeleteExpenseButton } from "@/features/expenses/delete-expense-button";
import { emptyStateClass, panelClass } from "@/features/auth/ui";

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
      <p className={emptyStateClass}>
        No expenses recorded yet. Recording all costs keeps your profit figures
        honest.
      </p>
    );
  }
  return (
    <div className={`${panelClass} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Recorded expenses</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 text-left font-normal">Date</th>
            <th scope="col" className="px-4 py-2.5 text-left font-normal">Category</th>
            <th scope="col" className="px-4 py-2.5 text-left font-normal">Description</th>
            <th scope="col" className="px-4 py-2.5 text-right font-normal">Amount</th>
            <th scope="col" className="px-4 py-2.5 text-left font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr
              key={expense.expenseId}
              className={`border-t border-rule first:border-t-0 ${expense.voidedAt ? "text-muted" : ""}`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-muted">{expense.date}</td>
              <td className="px-4 py-3 font-medium">{expense.category}</td>
              <td className="px-4 py-3 text-muted">
                {expense.description ?? "—"}
                {expense.voidReason ? ` (${expense.voidReason})` : ""}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium ${expense.voidedAt ? "line-through" : ""}`}
              >
                {formatMoney(expense.amount, currency)}
              </td>
              <td className="px-4 py-3 text-right">
                {expense.voidedAt ? (
                  <span className="inline-flex flex-none rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted">
                    Voided
                  </span>
                ) : (
                  <DeleteExpenseButton
                    businessId={businessId}
                    expenseId={expense.expenseId}
                  />
                )}
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
      <PageHeader
        title="Expenses"
        description="Rent, bills, salaries and other running costs. Recording every cost keeps your net profit honest. Stock you buy goes under Purchases."
      />
      <ExpenseForm
        businessId={businessId}
        currency={business.currency}
        timezone={business.timezone}
      />
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
    <Suspense fallback={<PageSkeleton />}>
      <ExpensesContent params={params} />
    </Suspense>
  );
}
