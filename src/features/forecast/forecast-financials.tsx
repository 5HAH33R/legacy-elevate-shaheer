import { formatMoney } from "@/lib/money";
import type { BusinessForecast } from "@/lib/forecast";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

export function ForecastFinancials({
  forecast,
  currency,
}: {
  forecast: BusinessForecast;
  currency: string;
}) {
  const { summary, horizon } = forecast;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Profit & Expense Forecast */}
      <section className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between">
            <h3 className={panelTitleClass}>Profit & Expense Projections</h3>
            <span className="text-xs text-muted">Next {horizon} days</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Estimates based on recent sales margins and active operational expenses run-rate.
          </p>
        </div>

        <div className="mt-5 flex flex-col divide-y divide-border text-sm">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-muted">Expected Revenue</span>
            <span className="num font-semibold">{formatMoney(summary.projectedSalesRevenue, currency)}</span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-muted">Cost of Goods Sold (COGS)</span>
            <span className="num text-muted">- {formatMoney(summary.projectedCOGS, currency)}</span>
          </div>

          <div className="flex items-center justify-between py-2.5 bg-surface-muted/40 px-2 rounded-md font-medium">
            <span className="text-foreground">Projected Gross Profit</span>
            <div className="text-right">
              <span className="num font-bold text-foreground">{formatMoney(summary.projectedGrossProfit, currency)}</span>
              <span className="ml-2 text-xs text-muted font-normal">({summary.grossMarginPercent}%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex flex-col">
              <span className="text-muted">Estimated Operating Expenses</span>
              <span className="text-[11px] text-muted">Based on prior {forecast.lookbackDays}d rate</span>
            </div>
            <span className="num text-danger">- {formatMoney(summary.projectedExpenses, currency)}</span>
          </div>

          <div className="flex items-center justify-between py-3 bg-surface-muted/60 px-3 rounded-lg mt-2">
            <div>
              <span className="font-bold text-base text-foreground">Projected Net Profit</span>
              <span className="block text-xs text-muted">After all recorded operating costs</span>
            </div>
            <div className="text-right">
              <span className={`num text-lg font-extrabold ${summary.projectedNetProfit >= 0 ? "text-emerald-500" : "text-danger"}`}>
                {formatMoney(summary.projectedNetProfit, currency)}
              </span>
              <span className="block text-xs font-semibold text-muted">{summary.netMarginPercent}% net margin</span>
            </div>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted">
          <InfoIcon className="mt-0.5 shrink-0" size={13} />
          <span>
            Only recorded business expenses are included. If certain bills (rent, utilities) are not yet entered,
            actual net profit will be lower.
          </span>
        </p>
      </section>

      {/* 2. Cash Flow Forecast */}
      <section className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between">
            <h3 className={panelTitleClass}>Cash Flow Forecast</h3>
            <span className="text-xs text-muted">Next {horizon} days</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Projected customer cash collections vs anticipated supplier restock and operating disbursements.
          </p>
        </div>

        <div className="mt-5 flex flex-col divide-y divide-border text-sm">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Projected Cash Inflows</span>
              <span className="text-[11px] text-muted">Expected customer receipts</span>
            </div>
            <span className="num font-semibold text-success">
              + {formatMoney(summary.projectedInflows, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Projected Cash Outflows</span>
              <span className="text-[11px] text-muted">Restocks ({formatMoney(summary.projectedCOGS, currency)}) + Expenses ({formatMoney(summary.projectedExpenses, currency)})</span>
            </div>
            <span className="num font-semibold text-danger">
              - {formatMoney(summary.projectedOutflows, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 bg-surface-muted/60 px-3 rounded-lg mt-2">
            <div>
              <span className="font-bold text-base text-foreground">Net Cash Balance</span>
              <span className="block text-xs text-muted">Projected surplus / deficit</span>
            </div>
            <span className={`num text-lg font-extrabold ${summary.projectedNetCashFlow >= 0 ? "text-emerald-500" : "text-danger"}`}>
              {formatMoney(summary.projectedNetCashFlow, currency)}
            </span>
          </div>
        </div>

        {summary.cashShortageWarning ? (
          <div className="mt-4 rounded-lg border border-danger-border bg-danger-bg p-3 text-xs text-danger flex items-start gap-2">
            <AlertIcon className="mt-0.5 shrink-0" size={14} />
            <div>
              <span className="font-bold">Potential Cash Shortage Alert:</span> Anticipated disbursements for restocks and expenses exceed projected cash inflows for this {horizon}-day horizon. Review restock priorities to protect liquid capital.
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-success-border bg-success-bg p-3 text-xs text-success flex items-start gap-2">
            <CheckIcon className="mt-0.5 shrink-0" size={14} />
            <div>
              <span className="font-bold">Adequate Inflow Buffer:</span> Projected revenue comfortably accommodates estimated inventory restocks and operating overhead.
            </div>
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted">
          <InfoIcon className="mt-0.5 shrink-0" size={13} />
          <span>
            Cash estimates assume prompt payment on sales. Supplier credit terms and delayed customer dues can alter exact daily balances.
          </span>
        </p>
      </section>
    </div>
  );
}
