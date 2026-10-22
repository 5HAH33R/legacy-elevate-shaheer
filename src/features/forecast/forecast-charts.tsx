"use client";

import { formatMoney } from "@/lib/money";
import type { BusinessForecast } from "@/lib/forecast";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

export function ForecastCharts({
  forecast,
  currency,
}: {
  forecast: BusinessForecast;
  currency: string;
}) {
  const { summary, horizon, products } = forecast;
  const historical = summary.historicalSalesRevenue;
  const projected = summary.projectedSalesRevenue;
  const maxVal = Math.max(historical, projected, 1);

  const histHeight = Math.max(12, Math.round((historical / maxVal) * 120));
  const projHeight = Math.max(12, Math.round((projected / maxVal) * 120));

  // Top products by projected revenue
  const topProducts = products
    .filter((p) => p.status === "ok" && p.projectedRevenue > 0)
    .sort((a, b) => (b.status === "ok" ? b.projectedRevenue : 0) - (a.status === "ok" ? a.projectedRevenue : 0))
    .slice(0, 5);

  const maxProdRevenue = topProducts[0]?.status === "ok" ? topProducts[0].projectedRevenue : 1;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Historical vs Projected Sales Comparison Chart */}
      <section className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between">
            <h3 className={panelTitleClass}>Sales Trend & Trajectory</h3>
            <span className="text-xs text-muted">Next {horizon} days</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Comparison between recent recorded sales pace and projected sales demand.
          </p>
        </div>

        <div className="mt-6 flex items-end justify-center gap-12 sm:gap-20 pb-4 pt-6 border-b border-border">
          {/* Historical Bar */}
          <div className="flex flex-col items-center gap-2 group">
            <span className="num text-xs font-semibold text-muted group-hover:text-foreground transition-colors">
              {formatMoney(historical, currency)}
            </span>
            <div
              style={{ height: `${histHeight}px` }}
              className="w-14 sm:w-16 rounded-t-lg bg-surface-muted border border-border border-b-0 transition-all hover:bg-surface-muted/80 shadow-xs"
            />
            <span className="text-xs font-medium text-muted">Past {forecast.lookbackDays} Days</span>
          </div>

          {/* Projected Bar */}
          <div className="flex flex-col items-center gap-2 group">
            <span className="num text-xs font-bold text-primary group-hover:underline">
              {formatMoney(projected, currency)}
            </span>
            <div
              style={{ height: `${projHeight}px` }}
              className="w-14 sm:w-16 rounded-t-lg bg-primary/20 border border-primary/40 border-b-0 transition-all hover:bg-primary/30 shadow-xs"
            />
            <span className="text-xs font-semibold text-primary">Next {horizon} Days (Proj)</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-muted">
          <span>Formula: Daily velocity extrapolated over horizon</span>
          <span>
            {summary.revenueGrowthRatePercent !== null ? (
              <span className={summary.revenueGrowthRatePercent >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>
                {summary.revenueGrowthRatePercent >= 0 ? "↗ Expected Increase" : "↘ Expected Decrease"}
              </span>
            ) : "Baseline stable"}
          </span>
        </div>
      </section>

      {/* 2. Top Projected Products Demand Breakdown */}
      <section className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between">
            <h3 className={panelTitleClass}>Top Demand Drivers</h3>
            <span className="text-xs text-muted">By projected revenue</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Products expected to generate the largest share of revenue in the next {horizon} days.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {topProducts.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">Not enough product sales history to rank demand.</p>
          ) : (
            topProducts.map((p) => {
              if (p.status !== "ok") return null;
              const percent = Math.min(100, Math.round((p.projectedRevenue / maxProdRevenue) * 100));
              return (
                <div key={p.productId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[200px]">{p.name}</span>
                    <span className="num text-muted">
                      {p.projected} units · <span className="font-semibold text-foreground">{formatMoney(p.projectedRevenue, currency)}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>{topProducts.length} high-velocity items listed</span>
          <span>Estimates, not guarantees</span>
        </div>
      </section>
    </div>
  );
}
