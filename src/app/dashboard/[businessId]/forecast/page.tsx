import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageBusiness } from "@/server/page-guards";
import { loadForecasts } from "@/server/ai/forecast";
import { getAiConfig } from "@/lib/env/server";
import { HORIZONS, LOOKBACK_DAYS, MIN_SALE_DAYS, parseHorizon } from "@/lib/forecast";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { ForecastExplain } from "@/features/forecast/forecast-explain";
import { AlertIcon, InfoIcon } from "@/components/icons";
import { emptyStateClass, panelPadClass } from "@/features/auth/ui";

export const metadata: Metadata = { title: "Forecast — Elevate" };

type Params = Promise<{ businessId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ForecastContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { businessId } = await params;
  const query = await searchParams;
  const business = await requirePageBusiness(businessId);
  const horizon = parseHorizon(query.horizon);
  const { forecasts } = await loadForecasts(business, horizon);
  const okCount = forecasts.filter((f) => f.status === "ok").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Demand forecast"
        description="Estimates, not guarantees. Based on your last 28 days of recorded sales."
        actions={
          <nav aria-label="Forecast horizon" className="flex gap-1">
            {HORIZONS.map((h) => (
              <Link
                key={h}
                href={`/dashboard/${businessId}/forecast?horizon=${h}`}
                aria-current={h === horizon ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-lg border px-3.5 text-sm ${h === horizon ? "border-control bg-active font-medium" : "border-border text-muted hover:bg-surface-muted"}`}
              >
                {h} days
              </Link>
            ))}
          </nav>
        }
      />

      <div role="note" className="flex gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-sm text-warning">
        <InfoIcon className="mt-0.5 shrink-0" />
        <p>
          Assumptions: sales continue at the recent pace; no price changes, promotions, festivals or stock-outs are
          accounted for. Estimates, not guarantees — the range shows how uneven the last two weeks were.
        </p>
      </div>

      {forecasts.length === 0 ? (
        <p className={emptyStateClass}>No products yet. Add products and record sales to see forecasts.</p>
      ) : (
        <section aria-labelledby="fc-heading" className="overflow-x-auto rounded-xl border border-border bg-surface">
          <h2 id="fc-heading" className="sr-only">Forecast for the next {horizon} days</h2>
          <table className="w-full min-w-[640px] text-sm">
            <caption className="px-4 py-3 text-left text-xs text-muted">
              Next {horizon} days · {okCount} of {forecasts.length} products have enough history
            </caption>
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-medium">Product</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">In stock</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Projected units</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Range</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Stock lasts</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Suggested restock</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.productId} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium" dir="auto">{f.name}</th>
                  <td className="num px-4 py-2.5 text-right">{f.currentStock}</td>
                  {f.status === "ok" ? (
                    <>
                      <td className="num px-4 py-2.5 text-right">{f.projected}</td>
                      <td className="num px-4 py-2.5 text-right">{f.low}–{f.high}</td>
                      <td className="num px-4 py-2.5 text-right">{f.stockCoverDays === null ? "No sales" : `about ${f.stockCoverDays} days`}</td>
                      <td className="num px-4 py-2.5 text-right">{f.suggestedRestockUnits} units</td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-4 py-2.5 text-right text-muted">
                      <AlertIcon size={12} className="mr-1 inline" />
                      Not enough history ({f.saleDays} of {MIN_SALE_DAYS} sale days)
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="ex-heading" className={`${panelPadClass} flex flex-col gap-3`}>
        <h2 id="ex-heading" className="text-base font-semibold">Explain in words</h2>
        <p className="text-sm text-muted">
          Formula: projected = units sold in the last {LOOKBACK_DAYS} days × days ahead ÷ {LOOKBACK_DAYS}. The AI only
          explains these numbers; it does not calculate them.
        </p>
        <ForecastExplain businessId={businessId} horizon={horizon} configured={getAiConfig() !== null && okCount > 0} />
      </section>
    </div>
  );
}

export default function ForecastPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ForecastContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
