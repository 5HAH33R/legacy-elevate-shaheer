import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { listSuppliersForBusiness } from "@/server/suppliers";
import { listPurchasesForBusiness } from "@/server/purchases";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { PurchaseList } from "@/features/purchases/purchase-list";
import { fieldClass, inputClass, labelClass, secondaryButtonClass } from "@/features/auth/ui";

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
      <PageHeader
        title="Purchases"
        description="Stock you buy from suppliers. A purchase adds to stock and sets each product's cost to the latest price you paid."
      />
      <PurchaseForm
        businessId={businessId}
        currency={business.currency}
        timezone={business.timezone}
        suppliers={active.map((s) => ({ supplierId: s.supplierId, name: s.name }))}
        products={products.map((p) => ({ productId: p.productId, name: p.name, unitCost: p.unitCost }))}
      />
      <form method="get" aria-label="Filter purchases" className="flex flex-wrap items-end gap-3">
        <div className={fieldClass}>
          <label htmlFor="f-from" className={labelClass}>From</label>
          <input id="f-from" name="from" type="date" defaultValue={q.from} className={`${inputClass} w-auto`} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="f-to" className={labelClass}>To</label>
          <input id="f-to" name="to" type="date" defaultValue={q.to} className={`${inputClass} w-auto`} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="f-sup" className={labelClass}>Supplier</label>
          <select id="f-sup" name="supplierId" defaultValue={q.supplierId ?? ""} className={`${inputClass} w-auto min-w-44`}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={`${secondaryButtonClass} h-10`}>Filter</button>
      </form>
      <PurchaseList purchases={purchases} currency={business.currency} businessId={businessId} />
    </div>
  );
}

export default function PurchasesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PurchasesContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
