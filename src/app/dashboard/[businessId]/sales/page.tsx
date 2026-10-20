import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { listSalesForBusiness, type Sale } from "@/server/sales";
import { formatMoney } from "@/lib/money";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { SaleForm } from "@/features/sales/sale-form";

export const metadata: Metadata = { title: "Sales — Elevate" };

function SaleList({ sales, currency }: { sales: Sale[]; currency: string }) {
  if (sales.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        No sales recorded yet. Confirmed sales appear here with their exact
        totals.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {sales.map((sale) => (
        <li
          key={sale.saleId}
          className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">{sale.date}</span>
            <span className="font-semibold">
              {formatMoney(sale.total, currency)}
            </span>
          </div>
          <p className="text-muted">
            {sale.items
              .map((item) => `${item.quantity} × ${item.name}`)
              .join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

async function SalesContent({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  const [products, sales] = await Promise.all([
    listProductsForBusiness(businessId),
    listSalesForBusiness(businessId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name} — Sales
        </h1>
        <p className="mt-1 text-sm text-muted">
          Recording a sale deducts stock immediately. Totals are calculated on
          the server.
        </p>
      </section>

      <BusinessNav businessId={businessId} />
      <SaleForm
        businessId={businessId}
        currency={business.currency}
        timezone={business.timezone}
        products={products.map((product) => ({
          productId: product.productId,
          name: product.name,
          sellingPrice: product.sellingPrice,
          quantity: product.quantity,
        }))}
      />
      <SaleList sales={sales} currency={business.currency} />
    </div>
  );
}

export default function SalesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <SalesContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
