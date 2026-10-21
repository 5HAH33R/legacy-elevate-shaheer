import { addDays, inPeriod } from "./periods";

/**
 * Deterministic restocking estimate (SPEC 5.2). Not a forecast guarantee.
 *
 *   avgDailySales = units sold in the last LOOKBACK_DAYS days (inclusive of
 *                   today, Asia/Karachi local dates) ÷ LOOKBACK_DAYS
 *   target        = ceil(avgDailySales × COVER_DAYS)
 *   suggested     = max(0, target + reorderLevel − currentStock)
 *
 * reorderLevel is added so stock after arrival sits above the alert level
 * for the whole cover window. "Insufficient history" when fewer than
 * MIN_SALE_DAYS distinct days in the window had sales of the product.
 * Integer maths: units × COVER_DAYS is divided once, then rounded up.
 */
export const LOOKBACK_DAYS = 30;
export const COVER_DAYS = 14;
export const MIN_SALE_DAYS = 3;

export type RestockSale = { date: string; items: { productId: string; quantity: number }[] };
export type RestockProduct = { productId: string; name: string; quantity: number; reorderLevel: number | null };

export type RestockSuggestion =
  | {
      kind: "estimate";
      productId: string;
      name: string;
      currentStock: number;
      unitsSold: number;
      saleDays: number;
      /** Average daily units × 100, rounded (for display without floats drifting). */
      avgDailyTimes100: number;
      suggestedQuantity: number;
    }
  | {
      kind: "insufficient-history";
      productId: string;
      name: string;
      currentStock: number;
      unitsSold: number;
      saleDays: number;
    };

export function suggestRestock(
  product: RestockProduct,
  sales: readonly RestockSale[],
  today: string,
  options: { lookbackDays?: number; coverDays?: number; minSaleDays?: number } = {},
): RestockSuggestion {
  const lookback = options.lookbackDays ?? LOOKBACK_DAYS;
  const cover = options.coverDays ?? COVER_DAYS;
  const minDays = options.minSaleDays ?? MIN_SALE_DAYS;
  const window = { from: addDays(today, -(lookback - 1)), to: today };

  let unitsSold = 0;
  const days = new Set<string>();
  for (const sale of sales) {
    if (!inPeriod(sale.date, window)) continue;
    for (const item of sale.items) {
      if (item.productId === product.productId && item.quantity > 0) {
        unitsSold += item.quantity;
        days.add(sale.date);
      }
    }
  }
  const base = {
    productId: product.productId,
    name: product.name,
    currentStock: product.quantity,
    unitsSold,
    saleDays: days.size,
  };
  if (days.size < minDays) return { kind: "insufficient-history", ...base };

  const target = Math.ceil((unitsSold * cover) / lookback);
  const suggestedQuantity = Math.max(0, target + (product.reorderLevel ?? 0) - product.quantity);
  return {
    kind: "estimate",
    ...base,
    avgDailyTimes100: Math.round((unitsSold * 100) / lookback),
    suggestedQuantity,
  };
}

/** "1.53" from 153 — display helper without float formatting. */
export function formatHundredths(value: number): string {
  return `${Math.trunc(value / 100)}.${String(Math.abs(value % 100)).padStart(2, "0")}`;
}
