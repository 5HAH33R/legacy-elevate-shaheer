import { multiplyMoney, sumMoney, type MinorUnits } from "./money";

/**
 * Deterministic business calculations (SPEC.md 5.4, AGENTS.md section 9).
 * Pure functions, unit-tested, no UI or database code. All money is integer
 * minor units; never floating point. AI features may explain these results
 * later but must never compute them.
 */

export type PricedItem = { unitPrice: MinorUnits; quantity: number };
export type CostedItem = PricedItem & { unitCost: MinorUnits };

/** Sale/line total: Σ unitPrice × quantity over validated items. */
export function calcItemsTotal(items: readonly PricedItem[]): MinorUnits {
  return sumMoney(
    items.map((item) => multiplyMoney(item.unitPrice, item.quantity)),
  );
}

/**
 * Gross profit: Σ (unitPrice − unitCost) × quantity.
 * Cost basis: the unit cost recorded on the sale at sale time. This is gross
 * profit only — never present it as net profit (expenses may be incomplete).
 */
export function calcGrossProfit(items: readonly CostedItem[]): MinorUnits {
  return sumMoney(
    items.map((item) =>
      multiplyMoney(item.unitPrice - item.unitCost, item.quantity),
    ),
  );
}

export type StockLevel = { quantity: number; reorderLevel: number | null };

/** Low stock = quantity at or below the owner-defined threshold (SPEC 5.2). */
export function isLowStock(stock: StockLevel): boolean {
  return stock.reorderLevel !== null && stock.quantity <= stock.reorderLevel;
}

export function lowStockItems<T extends StockLevel>(items: readonly T[]): T[] {
  return items.filter(isLowStock);
}
