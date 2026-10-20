import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageBusiness } from "@/server/page-guards";
import { getSupplierForBusiness } from "@/server/suppliers";
import { listPurchasesForBusiness } from "@/server/purchases";
import { ApiError } from "@/server/errors";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { SupplierForm } from "@/features/suppliers/supplier-form";
import { ArchiveSupplierButton } from "@/features/suppliers/archive-supplier-button";
import { PurchaseList } from "@/features/purchases/purchase-list";

export const metadata: Metadata = { title: "Supplier — Elevate" };

type Params = Promise<{ businessId: string; supplierId: string }>;

async function SupplierContent({ params }: { params: Params }) {
  const { businessId, supplierId } = await params;
  const business = await requirePageBusiness(businessId);
  let supplier;
  try {
    supplier = await getSupplierForBusiness(businessId, supplierId);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }
  const purchases = await listPurchasesForBusiness(businessId, { supplierId });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
      <BusinessNav businessId={businessId} />
      {supplier.archivedAt ? (
        <p className="text-sm text-muted">This supplier is archived.</p>
      ) : (
        <>
          <SupplierForm businessId={businessId} supplier={supplier} />
          <ArchiveSupplierButton businessId={businessId} supplierId={supplierId} />
        </>
      )}
      <h2 className="text-base font-semibold">Purchases from this supplier</h2>
      <PurchaseList purchases={purchases} currency={business.currency} businessId={businessId} />
    </div>
  );
}

export default function SupplierPage({ params }: { params: Params }) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <SupplierContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
