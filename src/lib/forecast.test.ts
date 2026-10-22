import { describe, expect, it } from "vitest";
import {
  calculateBusinessForecast,
  estimateStockoutDate,
  forecastProduct,
  parseHorizon,
  analyzeSeasonality,
} from "./forecast";

const product = { productId: "p1", name: "Rice 5kg", quantity: 10, unitCost: 80000, sellingPrice: 100000 };
const sale = (date: string, quantity: number) => ({
  date,
  items: [{ productId: "p1", quantity, unitPrice: 100000 }],
  total: quantity * 100000,
});

describe("forecastProduct", () => {
  it("needs at least 3 sale days", () => {
    const r = forecastProduct(product, [sale("2025-06-10", 5), sale("2025-06-11", 5)], "2025-06-15", 14);
    expect(r.status).toBe("insufficient-data");
  });

  it("projects with integer maths and a range", () => {
    const sales = [sale("2025-06-14", 14), sale("2025-06-13", 14), sale("2025-06-01", 14)];
    const r = forecastProduct(product, sales, "2025-06-15", 14);
    expect(r).toMatchObject({
      status: "ok",
      unitsSold: 42,
      projected: 21,
      low: 14,
      high: 28,
      suggestedRestockUnits: 18,
    });
    if (r.status === "ok") {
      expect(r.stockCoverDays).toBe(6);
      expect(r.stockRisk).toBe("critical_stockout");
      expect(r.movementCategory).toBe("fast_moving");
      expect(r.projectedRevenue).toBe(21 * 100000);
      expect(r.projectedCOGS).toBe(21 * 80000);
      expect(r.projectedGrossProfit).toBe(21 * 20000);
    }
  });

  it("ignores sales outside the window", () => {
    const r = forecastProduct(
      product,
      [sale("2025-01-01", 5), sale("2025-01-02", 5), sale("2025-01-03", 5)],
      "2025-06-15",
      7,
    );
    expect(r.status).toBe("insufficient-data");
  });
});

describe("estimateStockoutDate", () => {
  it("calculates exact calendar day for stock exhaustion", () => {
    expect(estimateStockoutDate("2025-06-15", 5)).toBe("2025-06-20");
    expect(estimateStockoutDate("2025-06-15", null)).toBeNull();
  });
});

describe("calculateBusinessForecast", () => {
  it("computes overall sales, margins, expenses, and cash flow", () => {
    const p1 = { productId: "p1", name: "Basmati Rice", quantity: 15, unitCost: 10000, sellingPrice: 15000 };
    const p2 = { productId: "p2", name: "Cooking Oil", quantity: 5, unitCost: 30000, sellingPrice: 40000 };
    const sales = [
      { date: "2025-06-14", items: [{ productId: "p1", quantity: 5, unitPrice: 15000 }, { productId: "p2", quantity: 2, unitPrice: 40000 }] },
      { date: "2025-06-10", items: [{ productId: "p1", quantity: 5, unitPrice: 15000 }, { productId: "p2", quantity: 2, unitPrice: 40000 }] },
      { date: "2025-06-01", items: [{ productId: "p1", quantity: 5, unitPrice: 15000 }, { productId: "p2", quantity: 2, unitPrice: 40000 }] },
    ];
    const expenses = [
      { date: "2025-06-10", amount: 50000 },
      { date: "2025-06-05", amount: 20000 },
    ];

    const bf = calculateBusinessForecast({
      products: [p1, p2],
      sales,
      expenses,
      today: "2025-06-15",
      horizon: 30,
    });

    expect(bf.summary.sufficientDataCount).toBe(2);
    expect(bf.summary.projectedSalesRevenue).toBeGreaterThan(0);
    expect(bf.summary.projectedGrossProfit).toBeGreaterThan(0);
    expect(bf.summary.grossMarginPercent).toBeGreaterThan(0);
    expect(bf.summary.projectedExpenses).toBeGreaterThan(0);
    expect(bf.seasonality).toBeDefined();
  });
});

describe("analyzeSeasonality", () => {
  it("identifies seasonal Pakistani products and indicates limited historical span", () => {
    const products = [
      { productId: "p1", name: "Aseel Dates Khajoor 500g", quantity: 20 },
      { productId: "p2", name: "Everyday Tea 900g", quantity: 10 },
    ];
    const res = analyzeSeasonality(products, [], "2025-03-01", 30);
    expect(res.hasSufficientHistory).toBe(false);
    expect(res.matchedProducts.some((p) => p.name.includes("Khajoor"))).toBe(true);
  });
});

describe("parseHorizon", () => {
  it("defaults to 14 and supports 7, 14, 30, 90", () => {
    expect(parseHorizon("99")).toBe(14);
    expect(parseHorizon(undefined)).toBe(14);
    expect(parseHorizon("7")).toBe(7);
    expect(parseHorizon("30")).toBe(30);
    expect(parseHorizon("90")).toBe(90);
  });
});
