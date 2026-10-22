import type { SeasonalityInsight } from "@/lib/forecast";
import { AlertIcon, InfoIcon } from "@/components/icons";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

export function ForecastSeasonality({
  seasonality,
  horizon,
}: {
  seasonality: SeasonalityInsight;
  horizon: number;
}) {
  const { activeEvents, matchedProducts, hasSufficientHistory, summaryNote } = seasonality;

  return (
    <section aria-labelledby="seasonal-heading" className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col gap-5`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="seasonal-heading" className={panelTitleClass}>
              Seasonal Demand & Festival Cycles
            </h3>
            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              🇵🇰 Pakistan Market Patterns
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Predictive demand shifts around Ramadan, Eid-ul-Fitr, Bakra Eid, and seasonal climate cycles.
          </p>
        </div>

        <span className="text-xs text-muted self-start sm:self-auto">
          Scope: Next {horizon} days
        </span>
      </div>

      {!hasSufficientHistory ? (
        <div role="note" className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg p-3 text-xs text-warning">
          <AlertIcon className="mt-0.5 shrink-0" size={14} />
          <div>
            <span className="font-semibold">Limited Historical Records Notice:</span> Your business has less than 6 months of sales recorded. Seasonal projections are guided by typical Pakistan retail trade cycles rather than multi-year historical comparison. We never fabricate trends.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Events */}
        {activeEvents.map((event) => (
          <div key={event.id} className="rounded-xl border border-border bg-surface-muted/30 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-foreground">{event.name}</h4>
                <span className="text-xs font-semibold text-muted" dir="rtl">{event.nameUrdu}</span>
              </div>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">{event.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted">Expected Demand Impact:</span>
              <span className="font-bold text-primary">High (+20% to +35%)</span>
            </div>
          </div>
        ))}

        {activeEvents.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4 text-xs text-muted col-span-2 text-center py-6">
            No specific cultural festivals occur in this horizon window. Regular baseline demand applies.
          </div>
        ) : null}
      </div>

      {/* Matched Products */}
      {matchedProducts.length > 0 ? (
        <div className="mt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5">
            Your Inventory Items Relevant to Upcoming Season
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matchedProducts.map((p) => (
              <div key={p.productId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs">
                <div>
                  <span className="font-medium text-foreground block truncate max-w-[170px]">{p.name}</span>
                  <span className="text-[11px] text-muted">{p.eventName}</span>
                </div>
                <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  +{Math.round((p.boostFactor - 1) * 100)}% buffer
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          No specific inventory items matched seasonal festival categories (e.g., Dates/Khajoor, Oil/Ghee, Spices, Tea, Beverages).
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <InfoIcon size={12} className="shrink-0" />
        <span>{summaryNote}</span>
      </p>
    </section>
  );
}
