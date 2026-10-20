import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { listSuppliersForBusiness } from "@/server/suppliers";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { SupplierForm } from "@/features/suppliers/supplier-form";

export const metadata: Metadata = { title: "Suppliers — Elevate" };

type Params = Promise<{ businessId: string }>;

async function SuppliersContent({ params }: { params: Params }) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  const suppliers = await listSuppliersForBusiness(businessId);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{business.name} — Suppliers</h1>
      <BusinessNav businessId={businessId} />
      <SupplierForm businessId={businessId} />
      {suppliers.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
          No suppliers yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suppliers.map((s) => (
            <li key={s.supplierId} className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <Link href={`/dashboard/${businessId}/suppliers/${s.supplierId}`} className="font-medium underline underline-offset-4">
                {s.name}
              </Link>
              <p className="text-muted">{s.contact.phone ?? s.contact.email ?? "No contact details"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SuppliersPage({ params }: { params: Params }) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <SuppliersContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
