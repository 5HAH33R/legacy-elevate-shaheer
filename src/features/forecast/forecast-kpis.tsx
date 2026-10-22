import { formatMoney } from "@/lib/money";
import type { BusinessForecast } from "@/lib/forecast";
import { AlertIcon, CheckIcon, SalesIcon } from "@/components/icons";
import { panelClass } from "@/features/auth/ui";

export function ForecastKpis({
  forecast,
  currency,
}: {
  forecast: BusinessForecast;
  currency: string;
}) {
  const { summary, horizon, seasonality } = forecast;
  const growth = summary.revenueGrowthRatePercent;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Expected Revenue */}
      <div className={`${panelClass} p-5 flex flex-col justify-between shadow-xs border-l-4 border-l-primary`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted">
            Expected Revenue ({horizon}d)
          </span>
          <SalesIcon size={18} className="text-primary" />
        </div>
        <div className="mt-3">
          <p className="num text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(summary.projectedSalesRevenue, currency)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            {growth !== null ? (
              <span className={`font-semibold ${growth >= 0 ? "text-success" : "text-danger"}`}>
                {growth >= 0 ? `+${growth}%` : `${growth}%`}
              </span>
            ) : null}
            <span>vs prior {forecast.lookbackDays}d pace</span>
          </p>
        </div>
      </div>

      {/* 2. Projected Net Profit */}
      <div className={`${panelClass} p-5 flex flex-col justify-between shadow-xs border-l-4 border-l-emerald-500`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted">
            Projected Profit ({horizon}d)
          </span>
          <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {summary.netMarginPercent}% net
          </span>
        </div>
        <div className="mt-3">
          <p className="num text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(summary.projectedNetProfit, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Gross: <span className="font-medium text-foreground">{formatMoney(summary.projectedGrossProfit, currency)}</span> ({summary.grossMarginPercent}%)
          </p>
        </div>
      </div>

      {/* 3. Stockout Risk Alerts */}
      <div className={`${panelClass} p-5 flex flex-col justify-between shadow-xs border-l-4 ${summary.criticalStockoutCount > 0 ? "border-l-danger bg-danger/5" : "border-l-control"}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted">
            Stockout Risks
          </span>
          {summary.criticalStockoutCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
              <AlertIcon size={12} /> {summary.criticalStockoutCount} critical
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
              <CheckIcon size={12} /> Stable
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="num text-2xl font-bold tracking-tight text-foreground">
            {summary.criticalStockoutCount + summary.stockoutRiskCount} <span className="text-sm font-normal text-muted">items</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {summary.criticalStockoutCount > 0
              ? `${summary.criticalStockoutCount} will exhaust within 7 days`
              : "No immediate stock-out risks detected"}
          </p>
        </div>
      </div>

      {/* 4. Seasonal Demand Event */}
      <div className={`${panelClass} p-5 flex flex-col justify-between shadow-xs border-l-4 border-l-amber-500`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted">
            Seasonal Cycles
          </span>
          <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
            🇵🇰 Pakistan
          </span>
        </div>
        <div className="mt-3">
          <p className="text-base font-bold tracking-tight text-foreground truncate">
            {seasonality.activeEvents[0]?.name ?? "Standard Demand"}
          </p>
          <p className="mt-1 text-xs text-muted truncate">
            {seasonality.matchedProducts.length > 0
              ? `${seasonality.matchedProducts.length} seasonal products identified`
              : "No specific keyword matches found"}
          </p>
        </div>
      </div>
    </div>
  );
}
