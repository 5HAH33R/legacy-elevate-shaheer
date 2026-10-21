import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { lowStockItems } from "@/lib/calculations";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
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
  const low = lowStockItems(products).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products & stock"
        description={
          products.length === 0
            ? "Your inventory. Sales take stock out automatically and purchases put it back."
            : `${products.length} product${products.length === 1 ? "" : "s"}${low > 0 ? `, ${low} running low` : ""}. Sales take stock out automatically and purchases put it back.`
        }
      />
      <ProductTable
        businessId={businessId}
        currency={business.currency}
        products={products}
      />
      <ProductForm businessId={businessId} currency={business.currency} />
    </div>
  );
}

export default function ProductsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsContent params={params} />
    </Suspense>
  );
}
