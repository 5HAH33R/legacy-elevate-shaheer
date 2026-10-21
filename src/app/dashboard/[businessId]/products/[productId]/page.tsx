import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageBusiness } from "@/server/page-guards";
import { getProductForBusiness } from "@/server/products";
import { listMovementsForProduct } from "@/server/inventory";
import { listPurchasesForProduct } from "@/server/purchases";
import { getSupplierComparisonForProduct } from "@/server/reports";
import { todayInTimeZone } from "@/lib/dates";
import { PricingCalculator } from "@/features/pricing/pricing-calculator";
import { PriceComparison } from "@/features/suppliers/price-comparison";
import { formatMoney } from "@/lib/money";
import { calcPriceScenario, formatRatio } from "@/lib/pricing";
import { isLowStock } from "@/lib/calculations";
import { AlertIcon } from "@/components/icons";
import { panelClass, panelTitleClass } from "@/features/auth/ui";
import { ApiError } from "@/server/errors";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { StockAdjustForm } from "@/features/products/stock-adjust-form";

export const metadata: Metadata = { title: "Product stock — Elevate" };

type Params = Promise<{ businessId: string; productId: string }>;

async function ProductContent({ params }: { params: Params }) {
  const { businessId, productId } = await params;
  const business = await requirePageBusiness(businessId);
  let product;
  try {
    product = await getProductForBusiness(businessId, productId);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }
  const [movements, allPurchases, comparison] = await Promise.all([
    listMovementsForProduct(businessId, productId),
    listPurchasesForProduct(businessId, productId),
    getSupplierComparisonForProduct(
      businessId,
      productId,
      todayInTimeZone(business.timezone),
    ),
  ]);
  const purchases = allPurchases.filter((p) => !p.voidedAt);
  const lastCostDate = product.costUpdatedFromPurchaseDate;
  const current = calcPriceScenario(product.sellingPrice, product.unitCost);
  const low = isLowStock(product);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link href={`/dashboard/${businessId}/products`} className="hover:text-foreground hover:underline">
            ← Products &amp; stock
          </Link>
        }
        title={product.name}
        description={`Cost basis ${formatMoney(product.unitCost, business.currency)}, ${
          lastCostDate ? `updated from the purchase on ${lastCostDate}` : "entered manually"
        }. Every stock change is recorded below.`}
      />
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        <div className="bg-surface px-5 py-4">
          <dt className="text-sm text-muted">In stock</dt>
          <dd className="num mt-1 flex items-center gap-2 text-xl font-semibold">
            {product.quantity}
            {low ? (
              <span className="inline-flex flex-none items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                <AlertIcon size={12} /> Low
              </span>
            ) : null}
          </dd>
        </div>
        <div className="bg-surface px-5 py-4">
          <dt className="text-sm text-muted">Low-stock alert at</dt>
          <dd className="num mt-1 text-xl font-semibold">{product.reorderLevel ?? <span className="text-muted">—</span>}</dd>
        </div>
        <div className="bg-surface px-5 py-4">
          <dt className="text-sm text-muted">Selling price</dt>
          <dd className="num mt-1 text-xl font-semibold">{formatMoney(product.sellingPrice, business.currency)}</dd>
        </div>
        <div className="bg-surface px-5 py-4">
          <dt className="text-sm text-muted">Margin at this price</dt>
          <dd className={`num mt-1 text-xl font-semibold ${current.status === "loss" ? "text-danger" : ""}`}>
            {formatRatio(current.marginPct)}
          </dd>
        </div>
      </dl>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <PricingCalculator
          unitCost={product.unitCost}
          currentPrice={product.sellingPrice}
          currency={business.currency}
        />
        <PriceComparison comparison={comparison} currency={business.currency} />
      </div>
      <StockAdjustForm businessId={businessId} productId={productId} />
      <section aria-labelledby="movements-heading" className={`${panelClass} overflow-x-auto`}>
        <h2 id="movements-heading" className={`${panelTitleClass} px-5 pt-5 pb-2 sm:px-6`}>Stock history</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="px-4 py-2.5 text-left font-normal sm:pl-6">When</th>
              <th scope="col" className="px-4 py-2.5 text-left font-normal">Type</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">Change</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">Stock after</th>
              <th scope="col" className="px-4 py-2.5 text-left font-normal">Reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.movementId} className="border-t border-rule first:border-t-0">
                <td className="px-4 py-3 whitespace-nowrap text-muted sm:pl-6">{m.createdAt?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                <td className="px-4 py-3 font-medium capitalize">{m.type}</td>
                <td className={`px-4 py-3 text-right font-medium ${m.quantityDelta > 0 ? "text-success" : ""}`}>
                  {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                </td>
                <td className="px-4 py-3 text-right">{m.quantityAfter}</td>
                <td className="px-4 py-3 text-muted">{m.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted sm:px-6">No stock changes recorded yet.</p>
        ) : null}
      </section>
      <section aria-labelledby="price-history-heading" className={`${panelClass} overflow-x-auto`}>
        <h2 id="price-history-heading" className={`${panelTitleClass} px-5 pt-5 pb-2 sm:px-6`}>Purchase price history</h2>
        {purchases.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted sm:px-6">No purchases of this product yet.</p>
        ) : (
          <div>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th scope="col" className="px-4 py-2.5 text-left font-normal sm:pl-6">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">Supplier</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-normal">Unit</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-normal">Unit cost</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-normal sm:pr-6">Qty</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const item = p.items.find((i) => i.productId === productId)!;
                  return (
                    <tr key={p.purchaseId} className="border-t border-rule first:border-t-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted sm:pl-6">{p.date}</td>
                      <td className="px-4 py-3 font-medium">{p.supplierName}</td>
                      <td className="px-4 py-3 text-muted">{item.unit}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.unitCost, business.currency)}</td>
                      <td className="px-4 py-3 text-right sm:pr-6">{item.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
