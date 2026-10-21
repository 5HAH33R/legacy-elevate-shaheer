import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import type { RestockSuggestion } from "@/lib/restock";
import { COVER_DAYS, LOOKBACK_DAYS, MIN_SALE_DAYS, formatHundredths } from "@/lib/restock";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

const MAX_ROWS = 6;

/**
 * Products at or below their low-stock level, each with a restock estimate
 * (or "not enough history"). The estimate is the order quantity, so it is
 * the figure in ink on the right.
 */
export function RestockSection({
  businessId,
  restock,
  reorderLevels,
  productCount,
}: {
  businessId: string;
  restock: RestockSuggestion[];
  reorderLevels: Record<string, number | null>;
  productCount: number;
}) {
  const rows = [...restock].sort((a, b) => a.currentStock - b.currentStock).slice(0, MAX_ROWS);

  return (
    <section aria-labelledby="restock-heading" className={`${panelClass} flex flex-col p-5 sm:p-6`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="restock-heading" className={panelTitleClass}>
          Low stock
          {restock.length > 0 ? <span className="num ml-2 text-sm font-normal text-muted">{restock.length}</span> : null}
        </h2>
        <Link href={`/dashboard/${businessId}/products`} className="text-sm font-medium hover:underline">
          Products
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <CheckIcon className="mt-0.5 shrink-0 text-success" />
          {productCount === 0
            ? "No products yet. Add products to track their stock."
            : "Nothing is at or below its low-stock level."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {rows.map((r) => (
            <li key={r.productId} className="flex items-center justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/${businessId}/products/${r.productId}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {r.name}
                </Link>
                <p className="num text-xs text-warning">
                  {r.currentStock} left · alert at {reorderLevels[r.productId] ?? "—"}
                </p>
              </div>
              {r.kind === "estimate" ? (
                <div className="shrink-0 text-right">
                  <p className="num text-sm font-semibold">Order ~{r.suggestedQuantity}</p>
                  <p className="num text-xs text-muted">{formatHundredths(r.avgDailyTimes100)}/day sold</p>
                </div>
              ) : (
                <div className="shrink-0 text-right">
                  <p className="text-sm text-muted">—</p>
                  <p className="text-xs text-muted">{r.saleDays} sale day{r.saleDays === 1 ? "" : "s"}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {restock.length > MAX_ROWS ? (
        <Link href={`/dashboard/${businessId}/products`} className="mt-2 text-sm font-medium hover:underline">
          View all {restock.length}
        </Link>
      ) : null}

      <p className="mt-auto pt-4 text-xs text-muted">
        Estimate: {LOOKBACK_DAYS}-day sales ÷ {LOOKBACK_DAYS} × {COVER_DAYS} days + alert level − stock. Needs sales on{" "}
        {MIN_SALE_DAYS}+ days. A rough guide, not a forecast.
      </p>
    </section>
  );
}
