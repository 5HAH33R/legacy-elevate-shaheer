import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatMoney, multiplyMoney, type MinorUnits } from "@/lib/money";
import { inPeriod, resolvePeriod, type Period } from "@/lib/periods";
import { formatRatio } from "@/lib/pricing";
import { formatHundredths } from "@/lib/restock";
import type { Business } from "../businesses";
import { buildDashboardReport, loadReportData, type DashboardReport, type ReportData } from "../reports";

/**
 * Grounding for the assistant (SPEC 8.2–8.4). Every number is computed by the
 * same deterministic code as the dashboard and pre-formatted, so the model
 * only has to quote figures, never calculate them. Only what an answer needs
 * is included: no owner id, emails, supplier contacts, document ids or costs
 * per purchase line.
 */
export const MAX_CONTEXT_PRODUCTS = 40;
export const MAX_TOP_PRODUCTS = 5;

/** Key figures saved with each answer so the owner can see what it was based on. */
export type FigureSnapshot = {
  currency: string;
  periods: {
    label: string;
    from: string;
    to: string;
    revenue: MinorUnits;
    grossProfit: MinorUnits;
    expenses: MinorUnits;
    estimatedNetProfit: MinorUnits;
    saleCount: number;
  }[];
  lowStockCount: number;
  productCount: number;
};

export type AssistantContext = {
  /** Compact JSON handed to the model. */
  json: string;
  snapshot: FigureSnapshot;
};

function periodBlock(report: DashboardReport, period: Period, currency: string) {
  const s = report.summary;
  const money = (v: MinorUnits) => formatMoney(v, currency);
  return {
    period: `${period.label} (${period.from} to ${period.to})`,
    revenue: money(s.revenue),
    costOfGoodsSold: money(s.cogs),
    grossProfit: money(s.grossProfit),
    grossMargin: formatRatio(s.grossMargin),
    recordedExpenses: money(s.expenses),
    estimatedNetProfitRecordedExpensesOnly: money(s.estimatedNetProfit),
    numberOfSales: s.saleCount,
    numberOfExpenses: s.expenseCount,
    dataWarnings: s.warnings.map((w) => w.message),
  };
}

function topProducts(data: ReportData, period: Period, currency: string) {
  const totals = new Map<string, { name: string; units: number; revenue: MinorUnits }>();
  for (const sale of data.sales) {
    if (!inPeriod(sale.date, period)) continue;
    for (const item of sale.items) {
      const row = totals.get(item.productId) ?? { name: item.name || "Unnamed product", units: 0, revenue: 0 };
      row.units += item.quantity;
      row.revenue += multiplyMoney(item.unitPrice, item.quantity);
      totals.set(item.productId, row);
    }
  }
  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.name.localeCompare(b.name))
    .slice(0, MAX_TOP_PRODUCTS)
    .map((r) => ({ name: r.name, unitsSold: r.units, revenue: formatMoney(r.revenue, currency) }));
}

/** Pure: build the context from already-loaded, already-authorized data. */
export function buildAssistantContext(business: Business, data: ReportData, today: string): AssistantContext {
  const currency = business.currency;
  const thisMonth = resolvePeriod({ period: "this-month" }, today).period;
  const lastMonth = resolvePeriod({ period: "last-month" }, today).period;
  const current = buildDashboardReport(data, thisMonth, today);
  const previous = buildDashboardReport(data, lastMonth, today);

  const products = [...data.products].sort((a, b) => a.name.localeCompare(b.name));
  const context = {
    business: {
      name: business.name,
      type: business.businessType ?? "not specified",
      currency,
      today,
    },
    note: "All money values are already calculated and formatted by the app. Quote them exactly; do not recalculate.",
    periods: [periodBlock(current, thisMonth, currency), periodBlock(previous, lastMonth, currency)],
    topProductsThisMonthByRevenue: topProducts(data, thisMonth, currency),
    stock: {
      productCount: data.products.length,
      lowStockCount: current.lowStockCount,
      lowStock: current.restock.map((r) => ({
        name: r.name,
        inStock: r.currentStock,
        lowStockAlertAt: current.reorderLevels[r.productId] ?? null,
        unitsSoldLast30Days: r.unitsSold,
        restockEstimate:
          r.kind === "estimate"
            ? `about ${r.suggestedQuantity} units (estimate from ${formatHundredths(r.avgDailyTimes100)} units/day over the last 30 days, 14 days cover)`
            : "not enough sales history for an estimate",
      })),
    },
    products: products.slice(0, MAX_CONTEXT_PRODUCTS).map((p) => ({
      name: p.name,
      inStock: p.quantity,
      sellingPrice: formatMoney(p.sellingPrice, currency),
      lowStockAlertAt: p.reorderLevel,
    })),
    productsListNote:
      products.length > MAX_CONTEXT_PRODUCTS
        ? `Only ${MAX_CONTEXT_PRODUCTS} of ${products.length} products are listed (alphabetical).`
        : "All products are listed.",
  };

  return {
    json: JSON.stringify(context),
    snapshot: {
      currency,
      periods: [
        { report: current, period: thisMonth },
        { report: previous, period: lastMonth },
      ].map(({ report, period }) => ({
        label: period.label,
        from: period.from,
        to: period.to,
        revenue: report.summary.revenue,
        grossProfit: report.summary.grossProfit,
        expenses: report.summary.expenses,
        estimatedNetProfit: report.summary.estimatedNetProfit,
        saleCount: report.summary.saleCount,
      })),
      lowStockCount: current.lowStockCount,
      productCount: data.products.length,
    },
  };
}

/** Caller MUST have run requireBusinessOwner() for business.businessId. */
export async function loadAssistantContext(
  business: Business,
  today: string,
  db: Firestore = getAdminDb(),
): Promise<AssistantContext> {
  return buildAssistantContext(business, await loadReportData(business.businessId, db), today);
}
