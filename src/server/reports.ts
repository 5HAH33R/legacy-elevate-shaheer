import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Period } from "@/lib/periods";
import {
  buildTrend,
  summarizePeriod,
  type PeriodSummary,
  type ReportExpense,
  type ReportPurchase,
  type Trend,
} from "@/lib/reports";
import { lowStockItems } from "@/lib/calculations";
import { suggestRestock, type RestockSuggestion } from "@/lib/restock";
import { compareSupplierPrices, type SupplierComparison } from "@/lib/supplier-comparison";
import { listProductsForBusiness, type Product } from "./products";
import { listSalesForBusiness, type Sale } from "./sales";
import { listExpensesForBusiness } from "./expenses";
import { listPurchasesForBusiness, listPurchasesForProduct } from "./purchases";

/**
 * Report data access. Callers MUST have run requireUser() →
 * requireBusinessOwner(businessId) first. Every query is a single-field
 * businessId query (no new composite index); filtering by period/product
 * happens in memory, then the pure functions in src/lib compute results.
 */
export type DashboardReport = {
  summary: PeriodSummary;
  trend: Trend;
  restock: RestockSuggestion[];
  lowStockCount: number;
  productCount: number;
  /** productId → owner-defined low-stock threshold, for the restock list. */
  reorderLevels: Record<string, number | null>;
};

/** One business's records, loaded once and shared by several reports. */
export type ReportData = {
  products: Product[];
  sales: Sale[];
  expenses: ReportExpense[];
  purchases: ReportPurchase[];
};

export async function loadReportData(
  businessId: string,
  db: Firestore = getAdminDb(),
): Promise<ReportData> {
  const [products, sales, expenses, purchases] = await Promise.all([
    listProductsForBusiness(businessId, db),
    listSalesForBusiness(businessId, db),
    listExpensesForBusiness(businessId, db),
    listPurchasesForBusiness(businessId, {}, db),
  ]);
  return {
    products,
    sales,
    expenses: expenses.map((e) => ({ date: e.date, amount: e.amount, voided: e.voidedAt !== null })),
    purchases: purchases.map((p) => ({ date: p.date, voided: p.voidedAt !== null })),
  };
}

/** Pure: the dashboard report for one period from already-loaded data. */
export function buildDashboardReport(
  data: ReportData,
  period: Period,
  today: string,
): DashboardReport {
  const { products, sales, expenses: reportExpenses, purchases: reportPurchases } = data;
  const lowStock = lowStockItems(products);
  return {
    summary: summarizePeriod(period, sales, reportExpenses, reportPurchases),
    trend: buildTrend(period, sales, reportExpenses),
    restock: lowStock.map((p) => suggestRestock(p, sales, today)),
    lowStockCount: lowStock.length,
    productCount: products.length,
    reorderLevels: Object.fromEntries(products.map((p) => [p.productId, p.reorderLevel])),
  };
}

export async function getDashboardReport(
  businessId: string,
  period: Period,
  today: string,
  db: Firestore = getAdminDb(),
): Promise<DashboardReport> {
  return buildDashboardReport(await loadReportData(businessId, db), period, today);
}

export async function getSupplierComparisonForProduct(
  businessId: string,
  productId: string,
  today: string,
  db: Firestore = getAdminDb(),
): Promise<SupplierComparison> {
  const purchases = await listPurchasesForProduct(businessId, productId, db);
  const lines = purchases.flatMap((p) =>
    p.items
      .filter((i) => i.productId === productId)
      .map((i) => ({
        purchaseId: p.purchaseId,
        supplierId: p.supplierId,
        supplierName: p.supplierName || "Unnamed supplier",
        date: p.date,
        createdAt: p.createdAt,
        voided: p.voidedAt !== null,
        unit: i.unit,
        unitCost: i.unitCost,
        quantity: i.quantity,
      })),
  );
  return compareSupplierPrices(lines, today);
}
