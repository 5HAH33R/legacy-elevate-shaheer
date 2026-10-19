import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { ProductForm } from "@/features/products/product-form";
import { ProductTable } from "@/features/products/product-table";

export const metadata: Metadata = { title: "Products — Elevate" };

async function ProductsContent({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  const products = await listProductsForBusiness(businessId);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name} — Products
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your inventory. Sales reduce stock automatically.
        </p>
      </section>

      <BusinessNav businessId={businessId} />
      <ProductForm businessId={businessId} currency={business.currency} />
      <ProductTable
        businessId={businessId}
        currency={business.currency}
        products={products}
      />
    </div>
  );
}

export default function ProductsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <ProductsContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
