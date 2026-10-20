import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { listSuppliersForBusiness } from "@/server/suppliers";
import { listPurchasesForBusiness } from "@/server/purchases";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { PurchaseList } from "@/features/purchases/purchase-list";
import { fieldClass, inputClass, labelClass, primaryButtonClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Purchases — Elevate" };

type Params = Promise<{ businessId: string }>;
type Search = Promise<{ from?: string; to?: string; supplierId?: string }>;

async function PurchasesContent({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { businessId } = await params;
  const q = await searchParams;
  const business = await requirePageBusiness(businessId);
  const [products, suppliers, purchases] = await Promise.all([
    listProductsForBusiness(businessId),
    listSuppliersForBusiness(businessId, true),
    listPurchasesForBusiness(businessId, q),
  ]);
  const active = suppliers.filter((s) => s.archivedAt === null);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{business.name} — Purchases</h1>
        <p className="mt-1 text-sm text-muted">
          Purchases increase stock and update each product&apos;s cost to the latest purchase cost.
        </p>
      </section>
      <BusinessNav businessId={businessId} />
      <PurchaseForm
        businessId={businessId}
        currency={business.currency}
        timezone={business.timezone}
        suppliers={active.map((s) => ({ supplierId: s.supplierId, name: s.name }))}
        products={products.map((p) => ({ productId: p.productId, name: p.name, unitCost: p.unitCost }))}
      />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className={fieldClass}>
          <label htmlFor="f-from" className={labelClass}>From</label>
          <input id="f-from" name="from" type="date" defaultValue={q.from} className={inputClass} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="f-to" className={labelClass}>To</label>
          <input id="f-to" name="to" type="date" defaultValue={q.to} className={inputClass} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="f-sup" className={labelClass}>Supplier</label>
          <select id="f-sup" name="supplierId" defaultValue={q.supplierId ?? ""} className={inputClass}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={primaryButtonClass}>Filter</button>
      </form>
      <PurchaseList purchases={purchases} currency={business.currency} businessId={businessId} />
    </div>
  );
}

export default function PurchasesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <PurchasesContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
