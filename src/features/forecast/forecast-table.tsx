"use client";

import { useMemo, useState } from "react";
import type { ProductForecast } from "@/lib/forecast";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { inputClass, panelClass, panelTitleClass } from "@/features/auth/ui";

type FilterTab = "all" | "risk" | "fast" | "slow";

export function ForecastTable({
  products,
  horizon,
}: {
  products: ProductForecast[];
  horizon: number;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase().trim())) {
        return false;
      }
      if (tab === "risk") {
        return p.stockRisk === "critical_stockout" || p.stockRisk === "stockout_risk";
      }
      if (tab === "fast") {
        return p.movementCategory === "fast_moving";
      }
      if (tab === "slow") {
        return p.movementCategory === "slow_moving" || p.stockRisk === "overstocked";
      }
      return true;
    });
  }, [products, tab, search]);

  const riskCount = products.filter((p) => p.stockRisk === "critical_stockout" || p.stockRisk === "stockout_risk").length;
  const fastCount = products.filter((p) => p.movementCategory === "fast_moving").length;
  const slowCount = products.filter((p) => p.movementCategory === "slow_moving" || p.stockRisk === "overstocked").length;

  return (
    <section aria-labelledby="inventory-fc-heading" className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col gap-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 id="inventory-fc-heading" className={panelTitleClass}>
            Product Demand & Stockout Projections
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Predicted unit sales, velocity, stock exhaustion dates, and suggested replenishment.
          </p>
        </div>

        {/* Search input */}
        <div className="w-full sm:w-64">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className={`${inputClass} h-9 text-xs`}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3 text-xs">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
            tab === "all" ? "bg-primary text-primary-foreground font-bold" : "text-muted hover:bg-surface-muted"
          }`}
        >
          All Items ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("risk")}
          className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
            tab === "risk" ? "bg-danger text-white font-bold" : "text-muted hover:bg-surface-muted"
          }`}
        >
          ⚠️ Stockout Risk ({riskCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("fast")}
          className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
            tab === "fast" ? "bg-surface-muted text-foreground font-bold" : "text-muted hover:bg-surface-muted"
          }`}
        >
          ⚡ Fast Moving ({fastCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("slow")}
          className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
            tab === "slow" ? "bg-surface-muted text-foreground font-bold" : "text-muted hover:bg-surface-muted"
          }`}
        >
          ⏳ Slow / Overstocked ({slowCount})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-surface-muted/60 text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th scope="col" className="px-4 py-3">Product</th>
              <th scope="col" className="px-3 py-3 text-right">In Stock</th>
              <th scope="col" className="px-3 py-3 text-right">Projected ({horizon}d)</th>
              <th scope="col" className="px-3 py-3">Stock Exhaustion Date</th>
              <th scope="col" className="px-3 py-3 text-center">Movement</th>
              <th scope="col" className="px-3 py-3 text-center">Risk Status</th>
              <th scope="col" className="px-4 py-3 text-right">Suggested Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No products matched the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isOk = p.status === "ok";
                return (
                  <tr key={p.productId} className="hover:bg-surface-muted/30 transition-colors">
                    <th scope="row" className="px-4 py-3 font-medium text-foreground">
                      <span className="block truncate max-w-[200px]" dir="auto">{p.name}</span>
                      {isOk && p.trend !== "steady" ? (
                        <span className={`text-[10px] font-semibold ${p.trend === "up" ? "text-success" : "text-amber-500"}`}>
                          {p.trend === "up" ? "↗ Demand rising" : "↘ Demand slowing"}
                        </span>
                      ) : null}
                    </th>

                    <td className="num px-3 py-3 text-right font-semibold">{p.currentStock}</td>

                    <td className="num px-3 py-3 text-right">
                      {isOk ? (
                        <div>
                          <span className="font-bold text-foreground">{p.projected}</span>
                          <span className="text-[10px] text-muted block">({p.low}–{p.high} range)</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {isOk && p.stockCoverDays !== null ? (
                        <div>
                          <span className={`font-semibold ${p.stockCoverDays <= 7 ? "text-danger" : p.stockCoverDays <= horizon ? "text-amber-500" : "text-foreground"}`}>
                            {p.stockoutDate ? p.stockoutDate : `~${p.stockCoverDays} days`}
                          </span>
                          <span className="text-[10px] text-muted block">
                            lasts ~{p.stockCoverDays} days
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">No recent sales</span>
                      )}
                    </td>

                    {/* Movement Badge */}
                    <td className="px-3 py-3 text-center">
                      {p.movementCategory === "fast_moving" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          ⚡ Fast
                        </span>
                      ) : p.movementCategory === "slow_moving" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                          ⏳ Slow
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-[10px] text-muted">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Risk Badge */}
                    <td className="px-3 py-3 text-center">
                      {p.stockRisk === "critical_stockout" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 text-[10px] font-bold text-danger">
                          <AlertIcon size={10} /> Critical
                        </span>
                      ) : p.stockRisk === "stockout_risk" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-500">
                          Risk
                        </span>
                      ) : p.stockRisk === "overstocked" ? (
                        <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-[10px] font-medium text-muted">
                          📦 Overstock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-medium text-success">
                          <CheckIcon size={10} /> Safe
                        </span>
                      )}
                    </td>

                    {/* Suggested Restock */}
                    <td className="num px-4 py-3 text-right">
                      {isOk && p.suggestedRestockUnits > 0 ? (
                        <span className="font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                          +{p.suggestedRestockUnits} units
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">Sufficient</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
