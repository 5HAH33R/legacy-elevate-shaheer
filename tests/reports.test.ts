import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { createFakeDb } from "./helpers/fakes";

const fakeDb = createFakeDb();
vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({}),
  getAdminDb: () => fakeDb,
}));

const db = fakeDb as unknown as Firestore;
const period = { preset: "this-month" as const, from: "2025-03-01", to: "2025-03-31", days: 31, label: "This month" };
const item = (productId: string, unitPrice: number, unitCost: number, quantity: number) => ({
  productId,
  name: productId,
  unitPrice,
  unitCost,
  quantity,
});

beforeEach(() => {
  fakeDb.reset();
  fakeDb.seed("products/p-a", { businessId: "biz-a", name: "Flour", quantity: 1, reorderLevel: 5, unitCost: 600, sellingPrice: 1000 });
  fakeDb.seed("products/p-b", { businessId: "biz-b", name: "Rice", quantity: 1, reorderLevel: 5, unitCost: 1, sellingPrice: 2 });
  fakeDb.seed("sales/s-a", { businessId: "biz-a", date: "2025-03-02", total: 2000, items: [item("p-a", 1000, 600, 2)] });
  fakeDb.seed("sales/s-b", { businessId: "biz-b", date: "2025-03-02", total: 9_999_000, items: [item("p-b", 9_999_000, 1, 1)] });
  fakeDb.seed("expenses/e-a", { businessId: "biz-a", date: "2025-03-03", category: "Rent", amount: 300 });
  fakeDb.seed("expenses/e-b", { businessId: "biz-b", date: "2025-03-03", category: "Rent", amount: 777_000 });
  fakeDb.seed("purchases/pu-a", {
    businessId: "biz-a", supplierId: "s1", supplierName: "Acme", date: "2025-03-01", voidedAt: null,
    items: [{ productId: "p-a", quantity: 1, unit: "pcs", unitCost: 600 }],
  });
  fakeDb.seed("purchases/pu-b", {
    businessId: "biz-b", supplierId: "s2", supplierName: "Other", date: "2025-03-01", voidedAt: new Date(),
    items: [{ productId: "p-a", quantity: 1, unit: "pcs", unitCost: 1 }],
  });
});

describe("server/reports isolation", () => {
  it("dashboard report only contains the requested business's records", async () => {
    const { getDashboardReport } = await import("@/server/reports");
    const r = await getDashboardReport("biz-a", period, "2025-03-30", db);
    expect(r.summary).toMatchObject({ revenue: 2000, expenses: 300, saleCount: 1, expenseCount: 1 });
    expect(r.summary.warnings.map((w) => w.code)).not.toContain("voided-purchases");
    expect(r.productCount).toBe(1);
    expect(r.restock.map((x) => x.productId)).toEqual(["p-a"]);
  });

  it("is empty for a business with no data", async () => {
    const { getDashboardReport } = await import("@/server/reports");
    const r = await getDashboardReport("biz-none", period, "2025-03-30", db);
    expect(r.summary.revenue).toBe(0);
    expect(r.productCount).toBe(0);
  });

  it("supplier comparison ignores another business's purchases of the same product id", async () => {
    const { getSupplierComparisonForProduct } = await import("@/server/reports");
    const c = await getSupplierComparisonForProduct("biz-a", "p-a", "2025-03-30", db);
    expect(c.groups).toHaveLength(1);
    expect(c.groups[0].lineCount).toBe(1);
    expect(c.groups[0].min).toMatchObject({ supplierName: "Acme", unitCost: 600 });
    expect(c.voidedExcluded).toBe(0);
  });
});
