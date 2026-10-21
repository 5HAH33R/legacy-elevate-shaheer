import { calcGrossProfit, type CostedItem } from "./calculations";
import { sumMoney, type MinorUnits } from "./money";
import { addDays, daysInclusive, inPeriod, weekdayIndex } from "./periods";
import { ratioBasisPoints, type Ratio } from "./pricing";

/**
 * Period financial summary (SPEC 5.4, 5.5). Pure; inputs are already-scoped
 * records of one business. Cost basis for COGS = unitCost snapshotted on the
 * sale line at sale time. Net profit is an ESTIMATE: gross profit minus only
 * the (non-voided) expenses the owner recorded in the period.
 */
export type ReportSale = { date: string; total: MinorUnits; items: (CostedItem & { productId: string; name: string })[] };
export type ReportExpense = { date: string; amount: MinorUnits; voided: boolean };
export type ReportPurchase = { date: string; voided: boolean };
export type DateRange = { from: string; to: string };

export type ReportWarning = { code: string; message: string };

export type PeriodSummary = {
  revenue: MinorUnits;
  cogs: MinorUnits;
  grossProfit: MinorUnits;
  grossMargin: Ratio;
  expenses: MinorUnits;
  estimatedNetProfit: MinorUnits;
  saleCount: number;
  expenseCount: number;
  warnings: ReportWarning[];
  /** True only when no completeness warning applies. Still "estimated". */
  looksComplete: boolean;
};

export function summarizePeriod(
  range: DateRange,
  sales: readonly ReportSale[],
  expenses: readonly ReportExpense[],
  purchases: readonly ReportPurchase[] = [],
): PeriodSummary {
  const periodSales = sales.filter((s) => inPeriod(s.date, range));
  const periodExpenses = expenses.filter((e) => !e.voided && inPeriod(e.date, range));
  const items = periodSales.flatMap((s) => s.items);

  const revenue = sumMoney(periodSales.map((s) => s.total));
  const grossProfit = calcGrossProfit(items);
  const cogs = revenue - grossProfit;
  const expenseTotal = sumMoney(periodExpenses.map((e) => e.amount));

  const warnings: ReportWarning[] = [];
  if (periodSales.length === 0) {
    warnings.push({ code: "no-sales", message: "No sales were recorded in this period." });
  }
  if (periodExpenses.length === 0) {
    warnings.push({
      code: "no-expenses",
      message:
        "No expenses were recorded in this period, so estimated net profit equals gross profit and is probably too high.",
    });
  }
  const zeroCostNames = [...new Set(items.filter((i) => i.unitCost <= 0).map((i) => i.name || "Unnamed product"))];
  if (zeroCostNames.length > 0) {
    warnings.push({
      code: "zero-cost",
      message: `Some sold items had a zero or unknown unit cost (${zeroCostNames.slice(0, 5).join(", ")}${zeroCostNames.length > 5 ? "…" : ""}), so COGS is understated and profit is overstated.`,
    });
  }
  const voided = purchases.filter((p) => p.voided && inPeriod(p.date, range)).length;
  if (voided > 0) {
    warnings.push({
      code: "voided-purchases",
      message: `${voided} purchase${voided === 1 ? " was" : "s were"} voided in this period. Product unit costs are not rolled back on void, so check costs used for sales.`,
    });
  }

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin: ratioBasisPoints(grossProfit, revenue, "Not calculable: no revenue in this period."),
    expenses: expenseTotal,
    estimatedNetProfit: grossProfit - expenseTotal,
    saleCount: periodSales.length,
    expenseCount: periodExpenses.length,
    warnings,
    looksComplete: warnings.length === 0,
  };
}

export type TrendBucket = {
  from: string;
  to: string;
  revenue: MinorUnits;
  expenses: MinorUnits;
  saleCount: number;
};

export type Trend =
  | { kind: "ok"; granularity: "day" | "week"; buckets: TrendBucket[] }
  | { kind: "not-enough-data"; reason: string };

/** Ranges up to this many days are shown per day; longer ones per week. */
export const DAILY_TREND_MAX_DAYS = 31;
/** A trend needs activity on at least this many distinct buckets. */
export const MIN_ACTIVE_BUCKETS = 2;

/**
 * Daily (≤31 days) or Monday-start weekly buckets, clipped to the range.
 * Returns "not enough data" when fewer than 2 buckets have any activity,
 * so a single data point is never shown as a trend.
 */
export function buildTrend(
  range: DateRange,
  sales: readonly { date: string; total: MinorUnits }[],
  expenses: readonly ReportExpense[],
): Trend {
  const granularity: "day" | "week" =
    daysInclusive(range.from, range.to) <= DAILY_TREND_MAX_DAYS ? "day" : "week";

  const buckets: TrendBucket[] = [];
  let cursor = range.from;
  while (cursor <= range.to) {
    let end = granularity === "day" ? cursor : addDays(cursor, 6 - weekdayIndex(cursor));
    if (end > range.to) end = range.to;
    buckets.push({ from: cursor, to: end, revenue: 0, expenses: 0, saleCount: 0 });
    cursor = addDays(end, 1);
  }
  const find = (date: string) => buckets.find((b) => date >= b.from && date <= b.to);
  for (const s of sales) {
    const b = inPeriod(s.date, range) ? find(s.date) : undefined;
    if (b) {
      b.revenue += s.total;
      b.saleCount += 1;
    }
  }
  for (const e of expenses) {
    const b = !e.voided && inPeriod(e.date, range) ? find(e.date) : undefined;
    if (b) b.expenses += e.amount;
  }
  const active = buckets.filter((b) => b.revenue !== 0 || b.expenses !== 0 || b.saleCount > 0).length;
  if (active < MIN_ACTIVE_BUCKETS) {
    return {
      kind: "not-enough-data",
      reason: `Not enough data for a trend: activity was recorded on ${active === 0 ? "no" : "only one"} ${granularity} in this period.`,
    };
  }
  return { kind: "ok", granularity, buckets };
}
