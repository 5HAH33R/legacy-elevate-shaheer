import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness } from "@/server/page-guards";
import { listProductsForBusiness } from "@/server/products";
import { getDashboardReport } from "@/server/reports";
import { todayInTimeZone } from "@/lib/dates";
import { resolvePeriod } from "@/lib/periods";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { PeriodFilter } from "@/features/reports/period-filter";
import { SummaryCards } from "@/features/reports/summary-cards";
import { TrendTable } from "@/features/reports/trend-table";
import { RestockSection } from "@/features/reports/restock-section";

export const metadata: Metadata = { title: "Business — Elevate" };

type Params = Promise<{ businessId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function BusinessSummary({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  // requireUser → requireBusinessOwner (404 for foreign ids) before any data call.
  const business = await requirePageBusiness(businessId);
  const today = todayInTimeZone(business.timezone);
  const { period, error } = resolvePeriod(query, today);
  const [report, products] = await Promise.all([
    getDashboardReport(businessId, period, today),
    listProductsForBusiness(businessId),
  ]);
  const reorderLevels = Object.fromEntries(
    products.map((p) => [p.productId, p.reorderLevel]),
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {business.businessType ?? "Business"} · {business.currency} · {period.label}
        </p>
      </section>

      <BusinessNav businessId={businessId} />

      <PeriodFilter
        period={period}
        error={error}
        requested={{ period: one(query.period), from: one(query.from), to: one(query.to) }}
      />
      <SummaryCards summary={report.summary} currency={business.currency} />
      <TrendTable trend={report.trend} currency={business.currency} />
      <RestockSection
        restock={report.restock}
        reorderLevels={reorderLevels}
        productCount={report.productCount}
      />
    </div>
  );
}

export default function BusinessDashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <BusinessSummary params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
