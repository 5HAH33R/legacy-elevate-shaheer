import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { listSuppliersForBusiness } from "@/server/suppliers";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { SupplierForm } from "@/features/suppliers/supplier-form";
import { emptyStateClass, panelClass, panelTitleClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Suppliers — Elevate" };

type Params = Promise<{ businessId: string }>;

async function SuppliersContent({ params }: { params: Params }) {
  const { businessId } = await params;
  await requirePageBusiness(businessId);
  const suppliers = await listSuppliersForBusiness(businessId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="The people and wholesalers you buy stock from. Open one to see what you paid them over time."
      />
      {suppliers.length === 0 ? (
        <p className={emptyStateClass}>
          No suppliers yet. Add the first one below, then record purchases against them.
        </p>
      ) : (
        <section aria-labelledby="suppliers-heading" className={panelClass}>
          <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2 sm:px-6">
            <h2 id="suppliers-heading" className={panelTitleClass}>Your suppliers</h2>
            <span className="num text-sm text-muted">{suppliers.length}</span>
          </div>
          <ul>
            {suppliers.map((s) => (
              <li key={s.supplierId} className="border-t border-rule first:border-t-0">
                <Link
                  href={`/dashboard/${businessId}/suppliers/${s.supplierId}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-surface-muted/60 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {s.contact.phone ?? s.contact.email ?? "No contact details"}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SupplierForm businessId={businessId} />
    </div>
  );
}

export default function SuppliersPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SuppliersContent params={params} />
    </Suspense>
  );
}
