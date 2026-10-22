import { describe, expect, it } from "vitest";
import { forecastProduct, parseHorizon } from "./forecast";

const product = { productId: "p1", name: "Rice", quantity: 10 };
const sale = (date: string, quantity: number) => ({ date, items: [{ productId: "p1", quantity }] });

describe("forecastProduct", () => {
  it("needs at least 3 sale days", () => {
    const r = forecastProduct(product, [sale("2025-06-10", 5), sale("2025-06-11", 5)], "2025-06-15", 14);
    expect(r.status).toBe("insufficient-data");
  });

  it("projects with integer maths and a range", () => {
    const sales = [sale("2025-06-14", 14), sale("2025-06-13", 14), sale("2025-06-01", 14)];
    const r = forecastProduct(product, sales, "2025-06-15", 14);
    expect(r).toMatchObject({ status: "ok", unitsSold: 42, projected: 21, low: 14, high: 28, suggestedRestockUnits: 18 });
    if (r.status === "ok") expect(r.stockCoverDays).toBe(6);
  });

  it("ignores sales outside the window", () => {
    const r = forecastProduct(product, [sale("2025-01-01", 5), sale("2025-01-02", 5), sale("2025-01-03", 5)], "2025-06-15", 7);
    expect(r.status).toBe("insufficient-data");
  });
});

describe("parseHorizon", () => {
  it("defaults to 14", () => {
    expect(parseHorizon("99")).toBe(14);
    expect(parseHorizon(undefined)).toBe(14);
    expect(parseHorizon("30")).toBe(30);
  });
});
