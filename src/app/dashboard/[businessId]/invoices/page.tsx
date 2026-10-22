import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { listInvoicesForBusiness, type Invoice } from "@/server/invoices";
import { getAiConfig } from "@/lib/env/server";
import { formatMoney } from "@/lib/money";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { InvoiceUpload } from "@/features/invoices/invoice-upload";
import { InvoiceStatusPill, InvoiceTypeBadge } from "@/features/invoices/invoice-status";
import { emptyStateClass, panelClass, panelTitleClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Invoices & Receipts — Elevate" };

type Params = Promise<{ businessId: string }>;
type Search = Promise<{ type?: string }>;

function InvoiceList({ businessId, invoices, currency }: { businessId: string; invoices: Invoice[]; currency: string }) {
  if (invoices.length === 0) {
    return <p className={emptyStateClass}>No invoices or receipts scanned yet. Your scans and their review status appear here.</p>;
  }
  const waiting = invoices.filter((i) => i.reviewStatus === "needs_review").length;
  return (
    <section aria-labelledby="invoices-heading" className={panelClass}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2 sm:px-6">
        <h2 id="invoices-heading" className={panelTitleClass}>Scanned documents</h2>
        <span className="text-sm text-muted">
          {waiting > 0 ? `${waiting} waiting for review` : `${invoices.length} total`}
        </span>
      </div>
      <ul>
        {invoices.map((inv) => {
          const x = inv.extractedData;
          const isSale = (inv.invoiceType ?? x.invoiceType) === "sale";
          const title = isSale
            ? x.customerName ?? "Customer receipt"
            : x.supplierName ?? "Supplier not read";

          return (
            <li key={inv.invoiceId} className="border-t border-rule first:border-t-0">
              <Link
                href={`/dashboard/${businessId}/invoices/${inv.invoiceId}`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-surface-muted/60 sm:px-6"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{title}</span>
                    {x.invoiceNumber ? <span className="font-normal text-muted"> · #{x.invoiceNumber}</span> : null}
                  </span>
                  <span className="num block truncate text-xs text-muted">
                    {inv.invoiceDate ?? "No date"} · {x.lines.length} line{x.lines.length === 1 ? "" : "s"} · scanned{" "}
                    {inv.createdAt.slice(0, 10)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="num hidden font-medium sm:inline">{x.total !== null ? formatMoney(x.total, currency) : "—"}</span>
                  <InvoiceTypeBadge type={isSale ? "sale" : "purchase"} />
                  <InvoiceStatusPill status={inv.reviewStatus} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function InvoicesContent({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { businessId } = await params;
  const q = await searchParams;
  const initialType = q.type === "sale" ? "sale" : "purchase";
  const business = await requirePageBusiness(businessId);
  const invoices = await listInvoicesForBusiness(businessId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices & Receipts"
        description="Scan supplier bills or customer sales receipts. Review what was read, match items to your inventory or add new products, and record them atomically."
      />
      <InvoiceUpload businessId={businessId} configured={getAiConfig() !== null} invoiceType={initialType} />
      <InvoiceList businessId={businessId} invoices={invoices} currency={business.currency} />
    </div>
  );
}

export default function InvoicesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoicesContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
