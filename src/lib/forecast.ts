import { addDays, inPeriod } from "./periods";

/**
 * Deterministic demand forecast (SPEC 5.6). Estimates, not guarantees.
 *
 * Over the last LOOKBACK_DAYS (28, today inclusive) the units sold are
 * counted, split into two 14-day halves. All maths is integer:
 *   projected = ceil(units × horizon ÷ 28)
 *   low/high  = ceil(min/max(half) × horizon ÷ 14)  (range between the halves)
 *   stockCoverDays = floor(stock × 28 ÷ units)  (null when nothing sold)
 *   suggestedRestock = max(0, high − stock)
 * Fewer than MIN_SALE_DAYS distinct days with sales → insufficient data.
 */
export const LOOKBACK_DAYS = 28;
export const MIN_SALE_DAYS = 3;
export const HORIZONS = [7, 14, 30] as const;
export type Horizon = (typeof HORIZONS)[number];

export type ForecastSale = { date: string; items: { productId: string; quantity: number }[] };
export type ForecastProduct = { productId: string; name: string; quantity: number };

export type ProductForecast =
  | {
      status: "ok";
      productId: string;
      name: string;
      currentStock: number;
      unitsSold: number;
      projected: number;
      low: number;
      high: number;
      stockCoverDays: number | null;
      suggestedRestockUnits: number;
    }
  | { status: "insufficient-data"; productId: string; name: string; currentStock: number; saleDays: number };

export function parseHorizon(value: string | string[] | undefined): Horizon {
  const v = Number(Array.isArray(value) ? value[0] : value);
  return (HORIZONS as readonly number[]).includes(v) ? (v as Horizon) : 14;
}

const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

export function forecastProduct(
  product: ForecastProduct,
  sales: readonly ForecastSale[],
  today: string,
  horizon: Horizon,
): ProductForecast {
  const windowStart = addDays(today, -(LOOKBACK_DAYS - 1));
  const midpoint = addDays(today, -13);
  let older = 0;
  let recent = 0;
  const days = new Set<string>();
  for (const sale of sales) {
    if (!inPeriod(sale.date, { from: windowStart, to: today })) continue;
    for (const item of sale.items) {
      if (item.productId !== product.productId || item.quantity <= 0) continue;
      days.add(sale.date);
      if (sale.date >= midpoint) recent += item.quantity;
      else older += item.quantity;
    }
  }
  if (days.size < MIN_SALE_DAYS) {
    return {
      status: "insufficient-data",
      productId: product.productId,
      name: product.name,
      currentStock: product.quantity,
      saleDays: days.size,
    };
  }
  const unitsSold = older + recent;
  const low = ceilDiv(Math.min(older, recent) * horizon, 14);
  const high = ceilDiv(Math.max(older, recent) * horizon, 14);
  const projected = Math.min(high, Math.max(low, ceilDiv(unitsSold * horizon, LOOKBACK_DAYS)));
  return {
    status: "ok",
    productId: product.productId,
    name: product.name,
    currentStock: product.quantity,
    unitsSold,
    projected,
    low,
    high,
    stockCoverDays: unitsSold > 0 ? Math.floor((product.quantity * LOOKBACK_DAYS) / unitsSold) : null,
    suggestedRestockUnits: Math.max(0, high - product.quantity),
  };
}

export function forecastAll(
  products: readonly ForecastProduct[],
  sales: readonly ForecastSale[],
  today: string,
  horizon: Horizon,
): ProductForecast[] {
  return products
    .map((p) => forecastProduct(p, sales, today, horizon))
    .sort((a, b) => a.name.localeCompare(b.name));
}
