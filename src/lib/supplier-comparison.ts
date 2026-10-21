import { sumMoney, type MinorUnits } from "./money";
import { ratioBasisPoints, type Ratio } from "./pricing";

/**
 * Supplier price comparison for one product (SPEC 5.3). Uses only the
 * owner's own non-voided purchase records — it never verifies or claims to
 * know current market prices.
 *
 * Rules (deterministic, documented):
 * - Prices are only compared within one unit (e.g. "pcs" vs "kg" are never
 *   mixed). Units are compared case-insensitively after trimming.
 * - "Latest per supplier" = the purchase with the newest date (ties: the
 *   later createdAt, then purchaseId) for each supplier in that unit.
 * - Min / max / average are over ALL non-voided purchase lines in that unit.
 *   The average is the simple mean of unit prices, rounded half up to the
 *   nearest minor unit.
 * - Outlier: a purchase line whose unit price differs from the median of the
 *   group by more than 50% of the median, and only when the group has at
 *   least 3 lines (fewer lines cannot establish a typical price).
 * - Reliability: fewer than 2 suppliers or fewer than 3 purchases in a unit
 *   group → "limited data"; the latest price older than 180 days → "stale".
 */
export type ComparisonPurchase = {
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  createdAt: string | null;
  voided: boolean;
  unit: string;
  unitCost: MinorUnits;
  quantity: number;
};

export type PriceSource = { purchaseId: string; supplierName: string; date: string; unitCost: MinorUnits };

export type SupplierLatest = PriceSource & {
  supplierId: string;
  /** Latest price − cheapest latest price (0 for the cheapest). */
  diffVsCheapest: MinorUnits;
  diffVsCheapestPct: Ratio;
  isCheapest: boolean;
};

export type UnitGroup = {
  unit: string;
  lineCount: number;
  supplierCount: number;
  min: PriceSource;
  max: PriceSource;
  average: MinorUnits;
  median: MinorUnits;
  latestBySupplier: SupplierLatest[];
  outliers: (PriceSource & { deviationPct: Ratio })[];
  reliability: string[];
};

export type SupplierComparison = {
  groups: UnitGroup[];
  voidedExcluded: number;
  notes: string[];
};

export const OUTLIER_THRESHOLD_BPS = 5_000; // 50%
export const OUTLIER_MIN_LINES = 3;
export const STALE_AFTER_DAYS = 180;

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase() || "pcs";
}

function newerFirst(a: ComparisonPurchase, b: ComparisonPurchase): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
    b.purchaseId.localeCompare(a.purchaseId)
  );
}

/** Median of integer prices; for even counts the mean of the two middle values, rounded half up. */
export function medianMinor(values: readonly MinorUnits[]): MinorUnits {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function source(p: ComparisonPurchase): PriceSource {
  return { purchaseId: p.purchaseId, supplierName: p.supplierName, date: p.date, unitCost: p.unitCost };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function compareSupplierPrices(
  purchases: readonly ComparisonPurchase[],
  today: string,
): SupplierComparison {
  const active = purchases.filter((p) => !p.voided);
  const voidedExcluded = purchases.length - active.length;
  const byUnit = new Map<string, ComparisonPurchase[]>();
  for (const p of active) {
    const key = normalizeUnit(p.unit);
    byUnit.set(key, [...(byUnit.get(key) ?? []), p]);
  }

  const groups: UnitGroup[] = [...byUnit.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([unit, lines]) => {
      const sorted = [...lines].sort(newerFirst);
      const byPrice = [...lines].sort((a, b) => a.unitCost - b.unitCost || newerFirst(a, b));
      const prices = lines.map((l) => l.unitCost);
      const median = medianMinor(prices);
      const average = Math.round(sumMoney(prices) / lines.length);

      const latestMap = new Map<string, ComparisonPurchase>();
      for (const p of sorted) if (!latestMap.has(p.supplierId)) latestMap.set(p.supplierId, p);
      const latest = [...latestMap.values()];
      const cheapest = Math.min(...latest.map((l) => l.unitCost));
      const latestBySupplier: SupplierLatest[] = latest
        .map((p) => ({
          ...source(p),
          supplierId: p.supplierId,
          diffVsCheapest: p.unitCost - cheapest,
          diffVsCheapestPct: ratioBasisPoints(p.unitCost - cheapest, cheapest, "Not calculable: cheapest price is zero."),
          isCheapest: p.unitCost === cheapest,
        }))
        .sort((a, b) => a.unitCost - b.unitCost || a.supplierName.localeCompare(b.supplierName));

      const outliers =
        lines.length >= OUTLIER_MIN_LINES && median > 0
          ? sorted
              .map((p) => ({ ...source(p), deviationPct: ratioBasisPoints(p.unitCost - median, median) }))
              .filter((o) => o.deviationPct.kind === "ok" && Math.abs(o.deviationPct.basisPoints) > OUTLIER_THRESHOLD_BPS)
          : [];

      const reliability: string[] = [];
      if (latest.length < 2) reliability.push("Only one supplier in this unit — there is nothing to compare against yet.");
      if (lines.length < OUTLIER_MIN_LINES) {
        reliability.push(`Only ${lines.length} purchase${lines.length === 1 ? "" : "s"} — too few for a reliable comparison or outlier check.`);
      }
      const age = daysBetween(sorted[0].date, today);
      if (age > STALE_AFTER_DAYS) reliability.push(`The newest price is ${age} days old and may no longer reflect what suppliers charge.`);
      if (cheapest === 0) reliability.push("A supplier price of zero was recorded — check that purchase.");

      return {
        unit,
        lineCount: lines.length,
        supplierCount: latest.length,
        min: source(byPrice[0]),
        max: source(byPrice[byPrice.length - 1]),
        average,
        median,
        latestBySupplier,
        outliers,
        reliability,
      };
    });

  const notes: string[] = [];
  if (groups.length > 1) {
    notes.push(
      `Purchases use ${groups.length} different units (${groups.map((g) => g.unit).join(", ")}). Prices are compared only within the same unit because they are not directly comparable.`,
    );
  }
  if (voidedExcluded > 0) notes.push(`${voidedExcluded} voided purchase${voidedExcluded === 1 ? " is" : "s are"} excluded.`);
  return { groups, voidedExcluded, notes };
}
