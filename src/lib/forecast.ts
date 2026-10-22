import { addDays, inPeriod } from "./periods";
import type { MinorUnits } from "./money";

/**
 * Deterministic multi-dimensional business forecast (SPEC 5.6).
 * Estimates, not guarantees.
 *
 * Maths uses integer arithmetic and minor units (paisa) for financial integrity:
 * - Sales Velocity: units sold in lookback period / lookback days.
 * - Stock Cover Days: currentStock / velocity (or null if no sales).
 * - Stockout Date: today + stockCoverDays.
 * - Projected Revenue: projectedUnits * sellingPrice.
 * - Projected COGS: projectedUnits * unitCost.
 * - Projected Gross Profit: Projected Revenue - Projected COGS.
 * - Projected Expenses: estimated daily run-rate * horizon days.
 * - Projected Net Profit: Projected Gross Profit - Projected Expenses.
 */
export const LOOKBACK_DAYS = 28;
export const MIN_SALE_DAYS = 3;
export const HORIZONS = [7, 14, 30, 90] as const;
export type Horizon = (typeof HORIZONS)[number];

export type ForecastSale = {
  date: string;
  items: { productId: string; quantity: number; unitPrice?: MinorUnits }[];
  total?: MinorUnits;
};

export type ForecastExpense = {
  date: string;
  amount: MinorUnits;
  category?: string;
};

export type ForecastProduct = {
  productId: string;
  name: string;
  quantity: number;
  unitCost?: MinorUnits;
  sellingPrice?: MinorUnits;
};

export type MovementCategory = "fast_moving" | "moderate" | "slow_moving";
export type StockRisk = "critical_stockout" | "stockout_risk" | "overstocked" | "healthy";

export type ProductForecast =
  | {
      status: "ok";
      productId: string;
      name: string;
      currentStock: number;
      unitsSold: number;
      projected: number;
      low: number;
      high: number;
      stockCoverDays: number | null;
      stockoutDate: string | null;
      suggestedRestockUnits: number;
      velocityPerDay: number;
      movementCategory: MovementCategory;
      stockRisk: StockRisk;
      trend: "up" | "down" | "steady";
      projectedRevenue: MinorUnits;
      projectedCOGS: MinorUnits;
      projectedGrossProfit: MinorUnits;
    }
  | {
      status: "insufficient-data";
      productId: string;
      name: string;
      currentStock: number;
      saleDays: number;
      stockRisk: StockRisk;
      movementCategory: MovementCategory;
    };

export type SeasonalEvent = {
  id: string;
  name: string;
  nameUrdu: string;
  description: string;
  months: number[]; // 1-12
  relevantKeywords: string[];
};

export const PAKISTAN_SEASONAL_EVENTS: readonly SeasonalEvent[] = [
  {
    id: "ramadan-eid-fitr",
    name: "Ramadan & Eid-ul-Fitr",
    nameUrdu: "رمضان المبارک اور عید الفطر",
    description: "Peak grocery, beverage, oil/ghee, dates, clothing, and sweet items demand.",
    months: [2, 3, 4], // Lunar shift around Feb-April in recent years
    relevantKeywords: ["date", "khajoor", "rooh", "sharbat", "oil", "ghee", "flour", "atta", "sugar", "cheeni", "rice", "chawal", "sweet", "mithai", "fabric", "cloth", "kurta", "bangle", "sewai"],
  },
  {
    id: "eid-ul-adha",
    name: "Eid-ul-Adha (Bakra Eid)",
    nameUrdu: "عید الاضحیٰ (بقرہ عید)",
    description: "High surge in spices, BBQ accessories, knives, salt, and food storage items.",
    months: [5, 6, 7],
    relevantKeywords: ["spice", "masala", "salt", "namak", "knife", "churi", "bbq", "coal", "koila", "grill", "bag", "thaili", "meat"],
  },
  {
    id: "wedding-winter",
    name: "Winter & Wedding Season (Shaadi)",
    nameUrdu: "موسم سرما اور شادی سیزن",
    description: "Increased demand for dry fruits, tea, warm apparel, blankets, cosmetics, and gifts.",
    months: [11, 12, 1, 2],
    relevantKeywords: ["tea", "chai", "coffee", "dry fruit", "badam", "pista", "warm", "shawl", "jacket", "blanket", "kambal", "suit", "cosmetic", "gift"],
  },
  {
    id: "summer-heatwave",
    name: "Summer & Heatwave Peaks",
    nameUrdu: "موسم گرما اور شدید گرمی",
    description: "Spike in cold beverages, juices, ice creams, cooling essentials, and light lawn fabrics.",
    months: [5, 6, 7, 8],
    relevantKeywords: ["cold drink", "beverage", "juice", "water", "ice", "lawn", "cotton", "fan", "cooler", "soap"],
  },
];

export type SeasonalityInsight = {
  hasSufficientHistory: boolean;
  activeEvents: SeasonalEvent[];
  matchedProducts: { productId: string; name: string; eventName: string; boostFactor: number }[];
  summaryNote: string;
};

export type BusinessForecast = {
  horizon: Horizon;
  today: string;
  lookbackDays: number;
  products: ProductForecast[];
  summary: {
    totalProducts: number;
    sufficientDataCount: number;
    insufficientDataCount: number;
    criticalStockoutCount: number;
    stockoutRiskCount: number;
    overstockCount: number;
    fastMovingCount: number;
    slowMovingCount: number;
    // Financials (in MinorUnits / paisa)
    historicalSalesRevenue: MinorUnits;
    projectedSalesRevenue: MinorUnits;
    projectedCOGS: MinorUnits;
    projectedGrossProfit: MinorUnits;
    historicalExpenses: MinorUnits;
    projectedExpenses: MinorUnits;
    projectedNetProfit: MinorUnits;
    grossMarginPercent: number;
    netMarginPercent: number;
    revenueGrowthRatePercent: number | null;
    // Cash Flow (in MinorUnits)
    projectedInflows: MinorUnits;
    projectedOutflows: MinorUnits;
    projectedNetCashFlow: MinorUnits;
    cashShortageWarning: boolean;
  };
  seasonality: SeasonalityInsight;
};

export function parseHorizon(value: string | string[] | undefined): Horizon {
  const v = Number(Array.isArray(value) ? value[0] : value);
  return (HORIZONS as readonly number[]).includes(v) ? (v as Horizon) : 14;
}

const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

/**
 * Calculates stock-out date given today's date string and number of days of cover.
 */
export function estimateStockoutDate(today: string, coverDays: number | null): string | null {
  if (coverDays === null) return null;
  return addDays(today, Math.max(0, coverDays));
}

export function forecastProduct(
  product: ForecastProduct,
  sales: readonly ForecastSale[],
  today: string,
  horizon: Horizon,
): ProductForecast {
  const windowStart = addDays(today, -(LOOKBACK_DAYS - 1));
  const midpoint = addDays(today, -13);
  let older = 0;
  let recent = 0;
  const days = new Set<string>();

  for (const sale of sales) {
    if (!inPeriod(sale.date, { from: windowStart, to: today })) continue;
    for (const item of sale.items) {
      if (item.productId !== product.productId || item.quantity <= 0) continue;
      days.add(sale.date);
      if (sale.date >= midpoint) recent += item.quantity;
      else older += item.quantity;
    }
  }

  const unitCost = product.unitCost ?? 0;
  const sellingPrice = product.sellingPrice ?? unitCost;

  if (days.size < MIN_SALE_DAYS) {
    const isOverstocked = product.quantity > 50;
    return {
      status: "insufficient-data",
      productId: product.productId,
      name: product.name,
      currentStock: product.quantity,
      saleDays: days.size,
      movementCategory: "slow_moving",
      stockRisk: isOverstocked ? "overstocked" : "healthy",
    };
  }

  const unitsSold = older + recent;
  const velocityPerDay = Number((unitsSold / LOOKBACK_DAYS).toFixed(2));
  const low = ceilDiv(Math.min(older, recent) * horizon, 14);
  const high = ceilDiv(Math.max(older, recent) * horizon, 14);
  const projected = Math.min(high, Math.max(low, ceilDiv(unitsSold * horizon, LOOKBACK_DAYS)));

  const stockCoverDays = unitsSold > 0 ? Math.floor((product.quantity * LOOKBACK_DAYS) / unitsSold) : null;
  const stockoutDate = estimateStockoutDate(today, stockCoverDays);
  const suggestedRestockUnits = Math.max(0, high - product.quantity);

  // Classify stock risk
  let stockRisk: StockRisk = "healthy";
  if (stockCoverDays !== null && stockCoverDays <= 7) {
    stockRisk = "critical_stockout";
  } else if (stockCoverDays !== null && stockCoverDays <= horizon) {
    stockRisk = "stockout_risk";
  } else if (stockCoverDays !== null && stockCoverDays > 90) {
    stockRisk = "overstocked";
  }

  // Classify velocity movement
  let movementCategory: MovementCategory = "moderate";
  if (velocityPerDay >= 1.0 || unitsSold >= 25) {
    movementCategory = "fast_moving";
  } else if (unitsSold <= 2 || (stockCoverDays !== null && stockCoverDays > 60)) {
    movementCategory = "slow_moving";
  }

  // Trend detection
  let trend: "up" | "down" | "steady" = "steady";
  if (recent > older * 1.2) trend = "up";
  else if (older > recent * 1.2) trend = "down";

  // Financial projections (minor units / paisa)
  const projectedRevenue = Math.round(projected * sellingPrice);
  const projectedCOGS = Math.round(projected * unitCost);
  const projectedGrossProfit = projectedRevenue - projectedCOGS;

  return {
    status: "ok",
    productId: product.productId,
    name: product.name,
    currentStock: product.quantity,
    unitsSold,
    projected,
    low,
    high,
    stockCoverDays,
    stockoutDate,
    suggestedRestockUnits,
    velocityPerDay,
    movementCategory,
    stockRisk,
    trend,
    projectedRevenue,
    projectedCOGS,
    projectedGrossProfit,
  };
}

export function forecastAll(
  products: readonly ForecastProduct[],
  sales: readonly ForecastSale[],
  today: string,
  horizon: Horizon,
): ProductForecast[] {
  return products
    .map((p) => forecastProduct(p, sales, today, horizon))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Evaluates Pakistan seasonal demand and identifies relevant products.
 */
export function analyzeSeasonality(
  products: readonly ForecastProduct[],
  sales: readonly ForecastSale[],
  today: string,
  horizon: Horizon,
): SeasonalityInsight {
  const currentMonth = Number(today.slice(5, 7)) || 1;
  const nextMonth = ((currentMonth % 12) + 1);
  const relevantMonths = horizon >= 60 ? [currentMonth, nextMonth, ((nextMonth % 12) + 1)] : [currentMonth, nextMonth];

  // Active seasonal events occurring in or near the horizon
  const activeEvents = PAKISTAN_SEASONAL_EVENTS.filter((event) =>
    event.months.some((m) => relevantMonths.includes(m)),
  );

  // Check historical span of sales data (need >= 180 days for reasonable seasonal comparison)
  const sortedSales = [...sales].sort((a, b) => a.date.localeCompare(b.date));
  const hasSufficientHistory =
    sortedSales.length > 0 &&
    (new Date(today).getTime() - new Date(sortedSales[0].date).getTime()) >= 180 * 24 * 60 * 60 * 1000;

  const matchedProducts: { productId: string; name: string; eventName: string; boostFactor: number }[] = [];

  for (const product of products) {
    const lowerName = product.name.toLowerCase();
    for (const event of activeEvents) {
      if (event.relevantKeywords.some((kw) => lowerName.includes(kw))) {
        matchedProducts.push({
          productId: product.productId,
          name: product.name,
          eventName: event.name,
          boostFactor: 1.25, // Suggested 25% buffer for seasonal peak
        });
        break;
      }
    }
  }

  const summaryNote = hasSufficientHistory
    ? `Based on Pakistan seasonal trends and your historical records. ${activeEvents.map((e) => e.name).join(", ")} approaching.`
    : `Historical seasonal data is limited (under 6 months of records). Seasonal trends are guided by Pakistan's retail calendar (Ramadan, Eid, and seasonal climate cycles).`;

  return {
    hasSufficientHistory,
    activeEvents,
    matchedProducts,
    summaryNote,
  };
}

/**
 * Computes complete deterministic business forecast including sales, financials,
 * inventory risks, cash flow, and seasonal patterns.
 */
export function calculateBusinessForecast(input: {
  products: readonly ForecastProduct[];
  sales: readonly ForecastSale[];
  expenses: readonly ForecastExpense[];
  today: string;
  horizon: Horizon;
}): BusinessForecast {
  const { products, sales, expenses, today, horizon } = input;
  const productForecasts = forecastAll(products, sales, today, horizon);

  const windowStart = addDays(today, -(LOOKBACK_DAYS - 1));

  // 1. Historical Sales Revenue in lookback window
  let historicalSalesRevenue: MinorUnits = 0;
  for (const sale of sales) {
    if (inPeriod(sale.date, { from: windowStart, to: today })) {
      if (typeof sale.total === "number" && sale.total > 0) {
        historicalSalesRevenue += sale.total;
      } else {
        for (const item of sale.items) {
          historicalSalesRevenue += Math.round(item.quantity * (item.unitPrice ?? 0));
        }
      }
    }
  }

  // 2. Historical Expenses in lookback window
  let historicalExpenses: MinorUnits = 0;
  for (const exp of expenses) {
    if (inPeriod(exp.date, { from: windowStart, to: today })) {
      historicalExpenses += exp.amount;
    }
  }

  // 3. Projected Financials across all products with sufficient data
  let projectedSalesRevenue: MinorUnits = 0;
  let projectedCOGS: MinorUnits = 0;
  let sufficientDataCount = 0;
  let criticalStockoutCount = 0;
  let stockoutRiskCount = 0;
  let overstockCount = 0;
  let fastMovingCount = 0;
  let slowMovingCount = 0;

  for (const pf of productForecasts) {
    if (pf.status === "ok") {
      sufficientDataCount++;
      projectedSalesRevenue += pf.projectedRevenue;
      projectedCOGS += pf.projectedCOGS;
      if (pf.stockRisk === "critical_stockout") criticalStockoutCount++;
      else if (pf.stockRisk === "stockout_risk") stockoutRiskCount++;
      else if (pf.stockRisk === "overstocked") overstockCount++;

      if (pf.movementCategory === "fast_moving") fastMovingCount++;
      else if (pf.movementCategory === "slow_moving") slowMovingCount++;
    } else {
      if (pf.stockRisk === "overstocked") overstockCount++;
      if (pf.movementCategory === "slow_moving") slowMovingCount++;
    }
  }

  const projectedGrossProfit = projectedSalesRevenue - projectedCOGS;

  // Extrapolate expenses based on daily run rate in lookback
  const dailyExpenseRate = historicalExpenses / LOOKBACK_DAYS;
  const projectedExpenses = Math.round(dailyExpenseRate * horizon);
  const projectedNetProfit = projectedGrossProfit - projectedExpenses;

  const grossMarginPercent = projectedSalesRevenue > 0
    ? Number(((projectedGrossProfit / projectedSalesRevenue) * 100).toFixed(1))
    : 0;

  const netMarginPercent = projectedSalesRevenue > 0
    ? Number(((projectedNetProfit / projectedSalesRevenue) * 100).toFixed(1))
    : 0;

  // Normalized revenue growth rate vs lookback period
  const normalizedHistorical = Math.round((historicalSalesRevenue * horizon) / LOOKBACK_DAYS);
  const revenueGrowthRatePercent = normalizedHistorical > 0
    ? Number((((projectedSalesRevenue - normalizedHistorical) / normalizedHistorical) * 100).toFixed(1))
    : null;

  // Cash Flow
  const projectedInflows = projectedSalesRevenue;
  // Outflows = operational expenses + restock COGS
  const projectedOutflows = projectedCOGS + projectedExpenses;
  const projectedNetCashFlow = projectedInflows - projectedOutflows;
  const cashShortageWarning = projectedOutflows > projectedInflows;

  // Seasonality
  const seasonality = analyzeSeasonality(products, sales, today, horizon);

  return {
    horizon,
    today,
    lookbackDays: LOOKBACK_DAYS,
    products: productForecasts,
    summary: {
      totalProducts: products.length,
      sufficientDataCount,
      insufficientDataCount: products.length - sufficientDataCount,
      criticalStockoutCount,
      stockoutRiskCount,
      overstockCount,
      fastMovingCount,
      slowMovingCount,
      historicalSalesRevenue,
      projectedSalesRevenue,
      projectedCOGS,
      projectedGrossProfit,
      historicalExpenses,
      projectedExpenses,
      projectedNetProfit,
      grossMarginPercent,
      netMarginPercent,
      revenueGrowthRatePercent,
      projectedInflows,
      projectedOutflows,
      projectedNetCashFlow,
      cashShortageWarning,
    },
    seasonality,
  };
}
