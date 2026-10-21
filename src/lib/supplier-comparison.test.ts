import { describe, expect, it } from "vitest";
import { compareSupplierPrices, type ComparisonPurchase } from "./supplier-comparison";

const today = "2025-03-01";
let n = 0;
function line(over: Partial<ComparisonPurchase> = {}): ComparisonPurchase {
  n += 1;
  return {
    purchaseId: `pu-${n}`,
    supplierId: "s1",
    supplierName: "Acme",
    date: "2025-02-01",
    createdAt: null,
    voided: false,
    unit: "pcs",
    unitCost: 100,
    quantity: 1,
    ...over,
  };
}

describe("compareSupplierPrices", () => {
  it("handles no purchases", () => {
    expect(compareSupplierPrices([], today).groups).toEqual([]);
  });

  it("flags a single supplier as nothing to compare", () => {
    const [g] = compareSupplierPrices([line()], today).groups;
    expect(g.supplierCount).toBe(1);
    expect(g.reliability.join(" ")).toMatch(/Only one supplier/);
    expect(g.min.supplierName).toBe("Acme");
    expect(g.min.date).toBe("2025-02-01");
  });

  it("normalises pcs/PCS into one group and keeps kg separate", () => {
    const c = compareSupplierPrices(
      [line({ unit: "pcs" }), line({ unit: " PCS ", supplierId: "s2", supplierName: "B" }), line({ unit: "kg" })],
      today,
    );
    expect(c.groups.map((g) => [g.unit, g.lineCount])).toEqual([
      ["pcs", 2],
      ["kg", 1],
    ]);
    expect(c.notes.join(" ")).toMatch(/not directly comparable/);
  });

  it("excludes voided purchases and says so", () => {
    const c = compareSupplierPrices([line(), line({ voided: true, unitCost: 1 })], today);
    expect(c.voidedExcluded).toBe(1);
    expect(c.groups[0].min.unitCost).toBe(100);
    expect(c.notes.join(" ")).toMatch(/1 voided purchase is excluded/);
  });

  it("uses the latest purchase per supplier and marks the cheapest", () => {
    const [g] = compareSupplierPrices(
      [
        line({ supplierId: "a", supplierName: "A", date: "2025-01-01", unitCost: 50 }),
        line({ supplierId: "a", supplierName: "A", date: "2025-02-01", unitCost: 120 }),
        line({ supplierId: "b", supplierName: "B", date: "2025-02-01", unitCost: 100 }),
      ],
      today,
    ).groups;
    expect(g.latestBySupplier.map((x) => [x.supplierName, x.unitCost, x.isCheapest])).toEqual([
      ["B", 100, true],
      ["A", 120, false],
    ]);
    expect(g.latestBySupplier[1].diffVsCheapest).toBe(20);
  });

  it("outlier exactly at 50% of the median is not flagged; above is", () => {
    const base = [line({ unitCost: 100 }), line({ unitCost: 100 })];
    const at = compareSupplierPrices([...base, line({ unitCost: 150 })], today).groups[0];
    expect(at.outliers).toEqual([]);
    const above = compareSupplierPrices([...base, line({ unitCost: 151 })], today).groups[0];
    expect(above.outliers.map((o) => o.unitCost)).toEqual([151]);
  });

  it("does not check outliers with fewer than 3 lines", () => {
    const g = compareSupplierPrices([line({ unitCost: 100 }), line({ unitCost: 1000 })], today).groups[0];
    expect(g.outliers).toEqual([]);
    expect(g.reliability.join(" ")).toMatch(/too few/);
  });

  it("marks prices older than 180 days as stale", () => {
    const g = compareSupplierPrices([line({ date: "2024-01-01" })], today).groups[0];
    expect(g.reliability.join(" ")).toMatch(/days old/);
    const fresh = compareSupplierPrices([line({ date: "2025-02-01" })], today).groups[0];
    expect(fresh.reliability.join(" ")).not.toMatch(/days old/);
  });

  it("copes with a zero price without NaN", () => {
    const g = compareSupplierPrices(
      [line({ unitCost: 0 }), line({ supplierId: "b", supplierName: "B", unitCost: 100 })],
      today,
    ).groups[0];
    expect(g.reliability.join(" ")).toMatch(/zero/);
    expect(g.latestBySupplier[1].diffVsCheapestPct.kind).toBe("undefined");
    expect(Number.isFinite(g.average)).toBe(true);
    expect(g.average).toBe(50);
  });
});
