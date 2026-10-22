import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { getAiConfig } from "@/lib/env/server";
import { todayInTimeZone } from "@/lib/dates";
import {
  calculateBusinessForecast,
  HORIZONS,
  type BusinessForecast,
  type Horizon,
  type ProductForecast,
} from "@/lib/forecast";
import { formatMoney } from "@/lib/money";
import type { Business } from "../businesses";
import { ApiError } from "../errors";
import { listProductsForBusiness } from "../products";
import { listSalesForBusiness } from "../sales";
import { listExpensesForBusiness } from "../expenses";
import { consumeDailyQuestion } from "./conversations";
import { AiError, generateAnswer } from "./provider";

export const forecastExplainSchema = z.object({
  horizon: z.coerce.number().refine((n) => (HORIZONS as readonly number[]).includes(n), "Invalid horizon."),
  language: z.enum(["en", "ur", "roman-ur"]).optional().default("en"),
});

export type SavedForecastSnapshot = {
  snapshotId: string;
  businessId: string;
  horizon: Horizon;
  today: string;
  createdAt: string;
  summary: {
    projectedSalesRevenue: number;
    projectedGrossProfit: number;
    projectedNetProfit: number;
    criticalStockoutCount: number;
    stockoutRiskCount: number;
    overstockCount: number;
    fastMovingCount: number;
  };
  aiInsight?: {
    text: string;
    model: string;
    language: string;
  };
};

const SNAPSHOTS_COLLECTION = "forecastSnapshots";

function serializeSnapshot(id: string, data: DocumentData): SavedForecastSnapshot {
  return {
    snapshotId: id,
    businessId: String(data.businessId ?? ""),
    horizon: (Number(data.horizon) || 14) as Horizon,
    today: String(data.today ?? ""),
    createdAt: String(data.createdAt ?? ""),
    summary: {
      projectedSalesRevenue: Number(data.summary?.projectedSalesRevenue ?? 0),
      projectedGrossProfit: Number(data.summary?.projectedGrossProfit ?? 0),
      projectedNetProfit: Number(data.summary?.projectedNetProfit ?? 0),
      criticalStockoutCount: Number(data.summary?.criticalStockoutCount ?? 0),
      stockoutRiskCount: Number(data.summary?.stockoutRiskCount ?? 0),
      overstockCount: Number(data.summary?.overstockCount ?? 0),
      fastMovingCount: Number(data.summary?.fastMovingCount ?? 0),
    },
    aiInsight: data.aiInsight
      ? {
          text: String(data.aiInsight.text ?? ""),
          model: String(data.aiInsight.model ?? ""),
          language: String(data.aiInsight.language ?? "en"),
        }
      : undefined,
  };
}

/** Caller MUST have run requireBusinessOwner() for this business. */
export async function loadForecasts(
  business: Business,
  horizon: Horizon,
  db: Firestore = getAdminDb(),
): Promise<{ today: string; forecasts: ProductForecast[]; businessForecast: BusinessForecast }> {
  const [products, sales, expenses] = await Promise.all([
    listProductsForBusiness(business.businessId, db),
    listSalesForBusiness(business.businessId, db),
    listExpensesForBusiness(business.businessId, db),
  ]);

  const activeExpenses = expenses.filter((e) => e.voidedAt === null);
  const today = todayInTimeZone(business.timezone);

  const businessForecast = calculateBusinessForecast({
    products: products.map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      unitCost: p.unitCost,
      sellingPrice: p.sellingPrice,
    })),
    sales: sales.map((s) => ({
      date: s.date,
      items: s.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      total: s.total,
    })),
    expenses: activeExpenses.map((e) => ({
      date: e.date,
      amount: e.amount,
      category: e.category,
    })),
    today,
    horizon,
  });

  return { today, forecasts: businessForecast.products, businessForecast };
}

/** Save a forecast snapshot with optional AI insight into Firestore. */
export async function saveForecastSnapshot(
  input: {
    businessId: string;
    uid: string;
    horizon: Horizon;
    today: string;
    summary: SavedForecastSnapshot["summary"];
    aiInsight?: SavedForecastSnapshot["aiInsight"];
  },
  db: Firestore = getAdminDb(),
): Promise<SavedForecastSnapshot> {
  const docRef = db.collection(SNAPSHOTS_COLLECTION).doc();
  const now = new Date().toISOString();
  const record = {
    businessId: input.businessId,
    createdBy: input.uid,
    horizon: input.horizon,
    today: input.today,
    createdAt: now,
    summary: input.summary,
    ...(input.aiInsight ? { aiInsight: input.aiInsight } : {}),
  };
  await docRef.set(record);
  return serializeSnapshot(docRef.id, record);
}

/** List previously saved snapshots for this business, newest first. */
export async function listForecastSnapshots(
  businessId: string,
  limit = 10,
  db: Firestore = getAdminDb(),
): Promise<SavedForecastSnapshot[]> {
  const snapshot = await db
    .collection(SNAPSHOTS_COLLECTION)
    .where("businessId", "==", businessId)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => serializeSnapshot(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const SYSTEM = `You are Elevate's AI business advisor for small Pakistani shops (dukaan/retail/wholesale).
Explain the demand and financial forecast clearly based ONLY on the numbers provided in <forecast_data>.
Never calculate or invent numbers; quote the calculated figures directly.

Key rules:
1. Clarify that forecasts are estimates, not guarantees, derived from historical patterns.
2. Outline:
   - Expected Revenue & Net Profit (mention currency PKR).
   - Stock-Out Risks & Reorder recommendations (highlight products running out soonest).
   - Slow-moving / overstocked capital alerts.
   - Pakistani Seasonality guidance (Ramadan, Eid, or Seasonal weather) if relevant.
3. Suggest 3-4 actionable steps for the shopkeeper.
4. Language instruction:
   - If language is 'ur', respond in clear, fluent Urdu script (اردو).
   - If language is 'roman-ur', respond in natural Roman Urdu (e.g. "Aapki basmati rice 6 din men khatam ho sakti hai").
   - If language is 'en', respond in clear plain English.`;

export async function explainForecast(
  input: { uid: string; business: Business; horizon: Horizon; language?: "en" | "ur" | "roman-ur" },
  db: Firestore = getAdminDb(),
): Promise<{ text: string; model: string; snapshotId?: string }> {
  const config = getAiConfig();
  if (!config) throw new ApiError(503, "The AI assistant is not configured yet.");
  const lang = input.language ?? "en";

  const { today, businessForecast } = await loadForecasts(input.business, input.horizon, db);
  if (businessForecast.summary.sufficientDataCount === 0 && businessForecast.summary.totalProducts === 0) {
    throw new ApiError(409, "There is not enough sales history to explain a forecast yet.");
  }

  await consumeDailyQuestion(input.uid, today, config.AI_DAILY_LIMIT, db);

  const cur = input.business.currency;
  const criticalProducts = businessForecast.products
    .filter((p) => p.status === "ok" && (p.stockRisk === "critical_stockout" || p.stockRisk === "stockout_risk"))
    .map((p) => p.status === "ok" ? `${p.name} (Stock: ${p.currentStock}, Cover: ${p.stockCoverDays}d, Restock: ${p.suggestedRestockUnits})` : "")
    .slice(0, 10);

  const seasonalInfo = businessForecast.seasonality.activeEvents.map((e) => e.name).join(", ");
  const matchedSeasonProducts = businessForecast.seasonality.matchedProducts.map((p) => p.name).slice(0, 5).join(", ");

  const promptData = JSON.stringify({
    horizonDays: input.horizon,
    today,
    currency: cur,
    revenueProjected: formatMoney(businessForecast.summary.projectedSalesRevenue, cur),
    grossProfitProjected: formatMoney(businessForecast.summary.projectedGrossProfit, cur),
    netProfitProjected: formatMoney(businessForecast.summary.projectedNetProfit, cur),
    projectedExpenses: formatMoney(businessForecast.summary.projectedExpenses, cur),
    projectedNetCashFlow: formatMoney(businessForecast.summary.projectedNetCashFlow, cur),
    cashShortageWarning: businessForecast.summary.cashShortageWarning,
    criticalStockoutProducts: criticalProducts,
    fastMovingCount: businessForecast.summary.fastMovingCount,
    slowMovingCount: businessForecast.summary.slowMovingCount,
    upcomingSeasonalEvents: seasonalInfo || "Standard retail period",
    seasonalProducts: matchedSeasonProducts || "None matched",
    seasonalDataLimited: !businessForecast.seasonality.hasSufficientHistory,
  });

  try {
    const answer = await generateAnswer(config, {
      system: `${SYSTEM}\nLanguage: ${lang}.\n\n<forecast_data>\n${promptData}\n</forecast_data>`,
      turns: [{ role: "user", text: "Explain this forecast and provide clear practical recommendations for my shop." }],
    });

    // Automatically persist snapshot to Firestore for reloadable history
    const snapshot = await saveForecastSnapshot(
      {
        businessId: input.business.businessId,
        uid: input.uid,
        horizon: input.horizon,
        today,
        summary: {
          projectedSalesRevenue: businessForecast.summary.projectedSalesRevenue,
          projectedGrossProfit: businessForecast.summary.projectedGrossProfit,
          projectedNetProfit: businessForecast.summary.projectedNetProfit,
          criticalStockoutCount: businessForecast.summary.criticalStockoutCount,
          stockoutRiskCount: businessForecast.summary.stockoutRiskCount,
          overstockCount: businessForecast.summary.overstockCount,
          fastMovingCount: businessForecast.summary.fastMovingCount,
        },
        aiInsight: {
          text: answer.text,
          model: answer.model,
          language: lang,
        },
      },
      db,
    );

    return { text: answer.text, model: answer.model, snapshotId: snapshot.snapshotId };
  } catch (error) {
    if (error instanceof AiError) throw new ApiError(error.kind === "rate-limited" ? 429 : 503, error.message);
    throw error;
  }
}
