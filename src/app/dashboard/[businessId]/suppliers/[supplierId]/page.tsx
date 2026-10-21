import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageBusiness } from "@/server/page-guards";
import { getSupplierForBusiness } from "@/server/suppliers";
import { listPurchasesForBusiness } from "@/server/purchases";
import { ApiError } from "@/server/errors";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { SupplierForm } from "@/features/suppliers/supplier-form";
import { ArchiveSupplierButton } from "@/features/suppliers/archive-supplier-button";
import { PurchaseList } from "@/features/purchases/purchase-list";
import { panelTitleClass } from "@/features/auth/ui";

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
      <PageHeader
        eyebrow={
          <Link href={`/dashboard/${businessId}/suppliers`} className="hover:text-foreground hover:underline">
            ← Suppliers
          </Link>
        }
        title={supplier.name}
        description={
          supplier.archivedAt
            ? "Archived. Past purchases stay on record."
            : `${purchases.length} purchase${purchases.length === 1 ? "" : "s"} recorded from this supplier.`
        }
      />
      {supplier.archivedAt ? null : (
        <>
          <SupplierForm businessId={businessId} supplier={supplier} />
          <ArchiveSupplierButton businessId={businessId} supplierId={supplierId} />
        </>
      )}
      <h2 className={panelTitleClass}>Purchases from this supplier</h2>
      <PurchaseList purchases={purchases} currency={business.currency} businessId={businessId} />
    </div>
  );
}

export default function SupplierPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SupplierContent params={params} />
    </Suspense>
  );
}
