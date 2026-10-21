import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { getDashboardReport } from "@/server/reports";
import { todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";
import { AssistantIcon, PlusIcon } from "@/components/icons";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { PeriodFilter } from "@/features/reports/period-filter";
import { SummaryCards } from "@/features/reports/summary-cards";
import { TrendTable } from "@/features/reports/trend-table";
import { RestockSection } from "@/features/reports/restock-section";
import { primaryActionClass, secondaryButtonClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Overview — Elevate" };

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
  const report = await getDashboardReport(businessId, period, today);
  const { summary } = report;

  // The finding under the title: the period's answer in one sentence.
  const finding =
    summary.saleCount === 0
      ? `No sales recorded for ${period.label.toLowerCase()} yet.`
      : `${formatMoney(summary.grossProfit, business.currency)} gross profit from ${summary.saleCount} sale${summary.saleCount === 1 ? "" : "s"}, ${period.label.toLowerCase()}.`;
  const stockNote =
    report.lowStockCount > 0
      ? ` ${report.lowStockCount} product${report.lowStockCount === 1 ? " is" : "s are"} running low.`
      : "";

  const base = `/dashboard/${businessId}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={`${finding}${stockNote}`}
        actions={
          <>
            <Link href={`${base}/assistant`} className={secondaryButtonClass}>
              <AssistantIcon />
              Ask assistant
            </Link>
            <Link href={`${base}/sales`} className={primaryActionClass}>
              <PlusIcon />
              Record a sale
            </Link>
          </>
        }
      />

      <PeriodFilter
        period={period}
        error={error}
        requested={{ period: one(query.period), from: one(query.from), to: one(query.to) }}
      />
      <SummaryCards summary={summary} currency={business.currency} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TrendTable trend={report.trend} currency={business.currency} />
        <RestockSection
          businessId={businessId}
          restock={report.restock}
          reorderLevels={report.reorderLevels}
          productCount={report.productCount}
        />
      </div>
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
    <Suspense fallback={<PageSkeleton />}>
      <BusinessSummary params={params} searchParams={searchParams} />
    </Suspense>
  );
}
