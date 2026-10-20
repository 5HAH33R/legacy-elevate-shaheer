import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { listSalesForBusiness } from "@/server/sales";
import { activeExpenses, listExpensesForBusiness } from "@/server/expenses";
import { calcGrossProfit, lowStockItems } from "@/lib/calculations";
import { formatMoney, sumMoney } from "@/lib/money";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";

export const metadata: Metadata = { title: "Business — Elevate" };

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

async function BusinessSummary({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  const [products, sales, allExpenses] = await Promise.all([
    listProductsForBusiness(businessId),
    listSalesForBusiness(businessId),
    listExpensesForBusiness(businessId),
  ]);
  const expenses = activeExpenses(allExpenses); // voided are excluded

  // All totals come from recorded data only — never estimated (AGENTS.md 12).
  const revenue = sumMoney(sales.map((sale) => sale.total));
  const expenseTotal = sumMoney(expenses.map((expense) => expense.amount));
  const grossProfit = calcGrossProfit(sales.flatMap((sale) => sale.items));
  const lowStock = lowStockItems(products);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {business.businessType ?? "Business"} · {business.currency} · All
          recorded data, all time
        </p>
      </section>

      <BusinessNav businessId={businessId} />

      <section
        aria-label="Recorded totals"
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Recorded revenue"
          value={formatMoney(revenue, business.currency)}
          hint={`From ${sales.length} confirmed ${sales.length === 1 ? "sale" : "sales"}`}
        />
        <StatCard
          label="Recorded expenses"
          value={formatMoney(expenseTotal, business.currency)}
          hint={`From ${expenses.length} expense ${expenses.length === 1 ? "record" : "records"}`}
        />
        <StatCard
          label="Gross profit (recorded)"
          value={formatMoney(grossProfit, business.currency)}
          hint="Sales minus recorded unit costs — not net profit"
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface-muted p-5">
        <h2 className="text-base font-semibold">How to read these numbers</h2>
        <p className="mt-2 text-sm text-muted">
          Every figure is calculated from your own recorded sales, expenses and
          product costs — Elevate never invents numbers. Gross profit is not
          net profit: it only includes the unit costs saved on your products,
          so rent and other unrecorded costs are not deducted yet.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Low-stock alerts</h2>
        {lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {products.length === 0
              ? "No products yet — add products to track stock."
              : "No product is at or below its low-stock level right now."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {lowStock.map((product) => (
              <li
                key={product.productId}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
              >
                <span className="font-medium">{product.name}</span>
                <span className="inline-flex items-center gap-1 text-warning">
                  <span aria-hidden="true">⚠</span>
                  {product.quantity} left (alert at {product.reorderLevel})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <BusinessSummary params={params} />
        </Suspense>
      </main>
    </>
  );
}
