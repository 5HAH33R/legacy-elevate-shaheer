import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageBusiness } from "@/server/page-guards";
import { getProductForBusiness } from "@/server/products";
import { listMovementsForProduct } from "@/server/inventory";
import { listPurchasesForProduct } from "@/server/purchases";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/server/errors";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
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
  const [movements, allPurchases, suppliersNote] = await Promise.all([
    listMovementsForProduct(businessId, productId),
    listPurchasesForProduct(businessId, productId),
    Promise.resolve(null),
  ]);
  void suppliersNote;
  const purchases = allPurchases.filter((p) => !p.voidedAt);
  const lastCostDate = purchases[0]?.date ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-sm text-muted">
          In stock: <strong>{product.quantity}</strong>. Every change is recorded
          below.
        </p>
        {lastCostDate ? (
          <p className="mt-1 text-sm text-muted">
            Cost {formatMoney(product.unitCost, business.currency)} — cost updated
            from purchase on {lastCostDate}.
          </p>
        ) : null}
      </section>
      <BusinessNav businessId={businessId} />
      <StockAdjustForm businessId={businessId} productId={productId} />
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">Stock after</th>
              <th className="px-4 py-3 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.movementId} className="border-t border-border">
                <td className="px-4 py-3">{m.createdAt?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{m.type}</td>
                <td className="px-4 py-3 text-right">
                  {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                </td>
                <td className="px-4 py-3 text-right">{m.quantityAfter}</td>
                <td className="px-4 py-3 text-muted">{m.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 ? (
          <p className="p-4 text-sm text-muted">No movements recorded yet.</p>
        ) : null}
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Purchase price history</h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted">No purchases of this product yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-right">Unit cost</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const item = p.items.find((i) => i.productId === productId)!;
                  return (
                    <tr key={p.purchaseId} className="border-t border-border">
                      <td className="px-4 py-3">{p.date}</td>
                      <td className="px-4 py-3">{p.supplierName}</td>
                      <td className="px-4 py-3">{item.unit}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.unitCost, business.currency)}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
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
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <ProductContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
