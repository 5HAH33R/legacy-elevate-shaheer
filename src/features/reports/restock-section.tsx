import type { RestockSuggestion } from "@/lib/restock";
import { COVER_DAYS, LOOKBACK_DAYS, MIN_SALE_DAYS, formatHundredths } from "@/lib/restock";

export function RestockSection({
  restock,
  reorderLevels,
  productCount,
}: {
  restock: RestockSuggestion[];
  reorderLevels: Record<string, number | null>;
  productCount: number;
}) {
  return (
    <section aria-labelledby="restock-heading" className="rounded-2xl border border-border bg-surface p-5">
      <h2 id="restock-heading" className="text-base font-semibold">Low-stock alerts &amp; restock estimates</h2>
      <p className="mt-1 text-sm text-muted">
        Estimate = {LOOKBACK_DAYS}-day sales ÷ {LOOKBACK_DAYS} × {COVER_DAYS} days + reorder level − current stock
        (rounded up, never below 0). It needs sales on at least {MIN_SALE_DAYS} different days in the last{" "}
        {LOOKBACK_DAYS}. It is a rough guide, not a forecast.
      </p>
      {restock.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {productCount === 0
            ? "No products yet — add products to track stock."
            : "No product is at or below its low-stock level right now."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {restock.map((r) => (
            <li key={r.productId} className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.name}</span>
                <span className="inline-flex items-center gap-1 text-warning">
                  <span aria-hidden="true">⚠</span>
                  {r.currentStock} left (alert at {reorderLevels[r.productId] ?? "—"})
                </span>
              </div>
              {r.kind === "estimate" ? (
                <p className="mt-1 text-muted">
                  Estimated restock: <strong className="text-foreground">{r.suggestedQuantity}</strong> units (estimate).
                  Sold {r.unitsSold} in {LOOKBACK_DAYS} days on {r.saleDays} days, about{" "}
                  {formatHundredths(r.avgDailyTimes100)}/day.
                </p>
              ) : (
                <p className="mt-1 text-muted">
                  <span aria-hidden="true">ℹ </span>Insufficient sales history for an estimate: sales on {r.saleDays}{" "}
                  {r.saleDays === 1 ? "day" : "days"} in the last {LOOKBACK_DAYS} (need {MIN_SALE_DAYS}).
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
