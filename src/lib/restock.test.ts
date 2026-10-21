import { describe, expect, it } from "vitest";
import { suggestRestock, type RestockProduct, type RestockSale } from "./restock";

const today = "2025-03-30"; // window: 2025-03-01 … 2025-03-30
const product: RestockProduct = { productId: "p", name: "Flour", quantity: 5, reorderLevel: 10 };
const s = (date: string, quantity: number, productId = "p"): RestockSale => ({
  date,
  items: [{ productId, quantity }],
});
const threeDays = [s("2025-03-05", 10), s("2025-03-10", 10), s("2025-03-20", 10)];

describe("suggestRestock", () => {
  it("is insufficient with fewer than 3 sale days", () => {
    const r = suggestRestock(product, [s("2025-03-05", 50), s("2025-03-06", 50)], today);
    expect(r).toMatchObject({ kind: "insufficient-history", saleDays: 2, unitsSold: 100 });
  });

  it("estimates 30-day sales ÷ 30 × 14 + reorder level − stock", () => {
    const r = suggestRestock(product, threeDays, today);
    // ceil(30 × 14 / 30) = 14; 14 + 10 − 5 = 19
    expect(r).toMatchObject({ kind: "estimate", suggestedQuantity: 19, avgDailyTimes100: 100 });
  });

  it("ignores sales outside the window and other products", () => {
    const r = suggestRestock(
      product,
      [...threeDays, s("2025-02-28", 1000), s("2025-03-31", 1000), s("2025-03-12", 1000, "other")],
      today,
    );
    expect(r).toMatchObject({ kind: "estimate", unitsSold: 30, saleDays: 3 });
  });

  it("treats a null reorder level as 0", () => {
    const r = suggestRestock({ ...product, reorderLevel: null }, threeDays, today);
    expect(r).toMatchObject({ kind: "estimate", suggestedQuantity: 9 });
  });

  it("returns 0 when stock is already enough", () => {
    const r = suggestRestock({ ...product, quantity: 500 }, threeDays, today);
    expect(r).toMatchObject({ kind: "estimate", suggestedQuantity: 0 });
  });

  it("counts several lines on one day as one sale day", () => {
    const r = suggestRestock(product, [s("2025-03-05", 1), s("2025-03-05", 1), s("2025-03-06", 1)], today);
    expect(r).toMatchObject({ kind: "insufficient-history", saleDays: 2 });
  });
});
