import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageBusiness } from "@/server/page-guards";
import { getInvoiceForBusiness } from "@/server/invoices";
import { listProductsForBusiness } from "@/server/products";
import { listSuppliersForBusiness } from "@/server/suppliers";
import { ApiError } from "@/server/errors";
import { formatMoney } from "@/lib/money";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { InvoiceReviewForm } from "@/features/invoices/invoice-review-form";
import { InvoiceStatusPill } from "@/features/invoices/invoice-status";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Review invoice — Elevate" };

type Params = Promise<{ businessId: string; invoiceId: string }>;

async function InvoiceContent({ params }: { params: Params }) {
  const { businessId, invoiceId } = await params;
  // requireUser → requireBusinessOwner (404 for foreign ids) before any data call.
  const business = await requirePageBusiness(businessId);
  let invoice;
  try {
    invoice = await getInvoiceForBusiness(businessId, invoiceId);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }
  const x = invoice.extractedData;
  const m = (v: number | null) => (v === null ? <span className="text-muted">—</span> : formatMoney(v, business.currency));
  const base = `/dashboard/${businessId}`;

  const reviewing = invoice.reviewStatus === "needs_review";
  const [products, suppliers] = reviewing
    ? await Promise.all([listProductsForBusiness(businessId), listSuppliersForBusiness(businessId)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link href={`${base}/invoices`} className="hover:text-foreground hover:underline">
            ← Invoices
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {reviewing ? "Review invoice" : x.supplierName ?? "Invoice"}
            <InvoiceStatusPill status={invoice.reviewStatus} />
          </span>
        }
        description={`${invoice.fileName} · scanned ${invoice.createdAt.slice(0, 10)}. ${
          reviewing
            ? "Check what was read against the paper copy. Nothing is recorded until you confirm."
            : invoice.reviewStatus === "confirmed"
              ? "Recorded as a purchase."
              : "Discarded. Nothing was recorded."
        }`}
      />

      <section aria-labelledby="read-heading" className={`${panelClass} p-5 sm:p-6`}>
        <h2 id="read-heading" className={panelTitleClass}>What the AI read</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-6">
          <div className="col-span-2">
            <dt className="text-xs text-muted">Supplier</dt>
            <dd className="mt-0.5 font-medium">{x.supplierName ?? <span className="text-muted">Not found</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Invoice no.</dt>
            <dd className="mt-0.5">{x.invoiceNumber ?? <span className="text-muted">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Date</dt>
            <dd className="num mt-0.5">{x.invoiceDate ?? <span className="text-muted">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Tax</dt>
            <dd className="num mt-0.5">{m(x.tax)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Total</dt>
            <dd className="num mt-0.5 font-semibold">{m(x.total)}</dd>
          </div>
        </dl>

        {x.issues.length > 0 ? (
          <ul aria-label="Things to check" className="mt-5 flex flex-col gap-1.5 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
            {x.issues.map((issue, i) => (
              <li key={`${issue.field}-${i}`} className="flex gap-2">
                <AlertIcon className="mt-0.5 shrink-0" />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted">
            <CheckIcon className="shrink-0 text-success" />
            Every line adds up and nothing was flagged. Still check it against the paper copy.
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs text-muted">
          <InfoIcon className="mt-0.5 shrink-0" />
          Read by AI{invoice.model ? ` (${invoice.model})` : ""}. AI can misread handwriting and faint print. The file itself
          was not stored.
        </p>
      </section>

      {reviewing ? (
        <InvoiceReviewForm
          businessId={businessId}
          invoiceId={invoiceId}
          currency={business.currency}
          extracted={x}
          suppliers={suppliers.map((s) => ({ id: s.supplierId, name: s.name }))}
          products={products.map((p) => ({ id: p.productId, name: p.name }))}
        />
      ) : invoice.reviewStatus === "confirmed" ? (
        <section className={`${panelClass} flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6`}>
          <p className="flex items-center gap-2 text-sm">
            <CheckIcon className="shrink-0 text-success" />
            Recorded as a purchase on {invoice.invoiceDate}
            {invoice.confirmedAt ? <span className="text-muted"> (confirmed {invoice.confirmedAt.slice(0, 10)})</span> : null}.
          </p>
          <div className="flex gap-4 text-sm font-medium">
            <Link href={`${base}/purchases`} className="hover:underline">View purchases</Link>
            {invoice.supplierId ? (
              <Link href={`${base}/suppliers/${invoice.supplierId}`} className="hover:underline">Supplier</Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function InvoicePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoiceContent params={params} />
    </Suspense>
  );
}
