import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { listSalesForBusiness, type Sale } from "@/server/sales";
import { formatMoney } from "@/lib/money";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { SaleForm } from "@/features/sales/sale-form";
import { emptyStateClass, panelClass, panelTitleClass, secondaryButtonClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Sales — Elevate" };

function SaleList({ sales, currency }: { sales: Sale[]; currency: string }) {
  if (sales.length === 0) {
    return (
      <p className={emptyStateClass}>
        No sales recorded yet. Confirmed sales appear here with their exact
        totals.
      </p>
    );
  }
  return (
    <section aria-labelledby="sales-heading" className={panelClass}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2 sm:px-6">
        <h2 id="sales-heading" className={panelTitleClass}>Recorded sales</h2>
        <span className="num text-sm text-muted">{sales.length}</span>
      </div>
      <ul>
        {sales.map((sale) => (
          <li
            key={sale.saleId}
            className="flex items-start justify-between gap-4 border-t border-rule px-5 py-3 text-sm first:border-t-0 sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {sale.items
                  .map((item) => `${item.quantity} × ${item.name}`)
                  .join(", ")}
              </p>
              <p className="num mt-0.5 text-xs text-muted">{sale.date}</p>
            </div>
            <span className="num shrink-0 font-semibold">
              {formatMoney(sale.total, currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
      <PageHeader
        title="Sales"
        description="Recording a sale takes the items out of stock straight away. Totals are calculated by Elevate, not typed in."
        actions={
          <Link
            href={`/dashboard/${businessId}/invoices?type=sale`}
            className={`${secondaryButtonClass} inline-flex items-center gap-1.5 h-10 px-4`}
          >
            <span>📷</span> Scan sales receipt
          </Link>
        }
      />

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
    <Suspense fallback={<PageSkeleton />}>
      <SalesContent params={params} />
    </Suspense>
  );
}
