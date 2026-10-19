import { describe, expect, it } from "vitest";
import {
  calcGrossProfit,
  calcItemsTotal,
  isLowStock,
  lowStockItems,
} from "./calculations";

describe("calcItemsTotal", () => {
  it("sums unitPrice × quantity across items in integer minor units", () => {
    expect(
      calcItemsTotal([
        { unitPrice: 125050, quantity: 2 }, // Rs 1,250.50 × 2
        { unitPrice: 9999, quantity: 3 }, // Rs 99.99 × 3
      ]),
    ).toBe(253107); // exact: no floating-point drift
  });

  it("returns 0 for an empty sale", () => {
    expect(calcItemsTotal([])).toBe(0);
  });
});

describe("calcGrossProfit", () => {
  it("subtracts the recorded cost basis per item", () => {
    expect(
      calcGrossProfit([
        { unitPrice: 150000, unitCost: 100000, quantity: 2 }, // +Rs 1,000
        { unitPrice: 50000, unitCost: 40000, quantity: 1 }, // +Rs 100
      ]),
    ).toBe(110000);
  });

  it("can be negative when items are sold below cost", () => {
    expect(
      calcGrossProfit([{ unitPrice: 8000, unitCost: 10000, quantity: 3 }]),
    ).toBe(-6000);
  });

  it("is zero when prices equal costs", () => {
    expect(
      calcGrossProfit([{ unitPrice: 5000, unitCost: 5000, quantity: 10 }]),
    ).toBe(0);
  });
});

describe("low stock", () => {
  it("flags quantity at or below the reorder level", () => {
    expect(isLowStock({ quantity: 4, reorderLevel: 5 })).toBe(true);
    expect(isLowStock({ quantity: 5, reorderLevel: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, reorderLevel: 5 })).toBe(false);
  });

  it("never flags products without a threshold", () => {
    expect(isLowStock({ quantity: 0, reorderLevel: null })).toBe(false);
  });

  it("filters a product list", () => {
    const products = [
      { name: "Flour", quantity: 2, reorderLevel: 5 },
      { name: "Sugar", quantity: 20, reorderLevel: 5 },
      { name: "Rice", quantity: 0, reorderLevel: null },
    ];
    expect(lowStockItems(products).map((p) => p.name)).toEqual(["Flour"]);
  });
});
