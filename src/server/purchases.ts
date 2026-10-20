import "server-only";

import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { calcItemsTotal } from "@/lib/calculations";
import type { MinorUnits } from "@/lib/money";
import { dateField, moneyField } from "@/lib/validation";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { ApiError } from "./errors";
import { applyStockMovements } from "./inventory";
import { toIso, toNullableString, toNumber } from "./serialize";

const purchaseItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1_000_000, "Quantity is too large."),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  unitCost: moneyField("Unit cost"),
});

/** purchaseId is a client UUID used as the doc id (idempotent, like sales). */
export const createPurchaseSchema = z.object({
  purchaseId: z.string().uuid("Invalid purchase id."),
  supplierId: z.string().trim().min(1, "Choose a supplier."),
  date: dateField.optional(),
  items: z
    .array(purchaseItemSchema)
    .min(1, "Add at least one item.")
    .max(50, "A purchase can have at most 50 items."),
  notes: z.string().trim().max(500).optional(),
  sourceDocumentId: z.string().trim().max(120).optional(),
});
export type CreatePurchaseInput = z.output<typeof createPurchaseSchema>;

export type PurchaseItem = {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: MinorUnits;
};

/** SPEC.md 9.7. */
export type Purchase = {
  purchaseId: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  total: MinorUnits;
  notes: string | null;
  sourceDocumentId: string | null;
  createdBy: string | null;
  createdAt: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
};

function serializePurchase(id: string, data: DocumentData): Purchase {
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    purchaseId: id,
    businessId: String(data.businessId ?? ""),
    supplierId: String(data.supplierId ?? ""),
    supplierName: String(data.supplierName ?? ""),
    date: String(data.date ?? ""),
    items: items.map((raw: Record<string, unknown>) => ({
      productId: String(raw?.productId ?? ""),
      name: String(raw?.name ?? ""),
      quantity: toNumber(raw?.quantity),
      unit: String(raw?.unit ?? "pcs"),
      unitCost: toNumber(raw?.unitCost),
    })),
    total: toNumber(data.total),
    notes: toNullableString(data.notes),
    sourceDocumentId: toNullableString(data.sourceDocumentId),
    createdBy: toNullableString(data.createdBy),
    createdAt: toIso(data.createdAt),
    voidedAt: toIso(data.voidedAt),
    voidedBy: toNullableString(data.voidedBy),
  };
}

export type PurchaseFilter = { from?: string; to?: string; supplierId?: string };

/**
 * Single-field query on businessId; date range, supplier filter and
 * newest-first sort happen in memory. Acceptable at MVP scale (a small shop
 * has hundreds, not millions, of purchases) and avoids composite indexes.
 */
export async function listPurchasesForBusiness(
  businessId: string,
  filter: PurchaseFilter = {},
  db: Firestore = getAdminDb(),
): Promise<Purchase[]> {
  const snapshot = await db
    .collection("purchases")
    .where("businessId", "==", businessId)
    .get();
  return snapshot.docs
    .map((doc) => serializePurchase(doc.id, doc.data()))
    .filter(
      (p) =>
        (!filter.from || p.date >= filter.from) &&
        (!filter.to || p.date <= filter.to) &&
        (!filter.supplierId || p.supplierId === filter.supplierId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function listPurchasesForProduct(
  businessId: string,
  productId: string,
  db: Firestore = getAdminDb(),
): Promise<Purchase[]> {
  const all = await listPurchasesForBusiness(businessId, {}, db);
  return all.filter((p) => p.items.some((i) => i.productId === productId));
}

export type RecordPurchaseResult = { purchase: Purchase; created: boolean };

export async function recordPurchaseForBusiness(
  businessId: string,
  input: CreatePurchaseInput,
  actorId: string | null = null,
  timeZone: string = DEFAULT_TIME_ZONE,
  db: Firestore = getAdminDb(),
): Promise<RecordPurchaseResult> {
  const productIds = input.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, "Combine quantities for the same product into one row.");
  }
  const ref = db.collection("purchases").doc(input.purchaseId);
  const date = input.date ?? todayInTimeZone(timeZone);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const data = existing.data();
      if (!data || data.businessId !== businessId) {
        throw new ApiError(409, "This purchase could not be recorded. Please retry.");
      }
      return { purchase: serializePurchase(existing.id, data), created: false };
    }

    const supplierSnap = await tx.get(db.collection("suppliers").doc(input.supplierId));
    const supplier = supplierSnap.data();
    if (!supplierSnap.exists || !supplier || supplier.businessId !== businessId) {
      throw new ApiError(400, "The supplier does not belong to this business.");
    }
    if (supplier.archivedAt) {
      throw new ApiError(409, "This supplier is archived.");
    }

    const productRefs = productIds.map((id) => db.collection("products").doc(id));
    const snaps = await Promise.all(productRefs.map((r) => tx.get(r)));
    const items: PurchaseItem[] = snaps.map((snap, index) => {
      const data = snap.data();
      if (!snap.exists || !data || data.businessId !== businessId) {
        throw new ApiError(400, "One of the products does not belong to this business.");
      }
      const line = input.items[index];
      return {
        productId: snap.id,
        name: String(data.name ?? ""),
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
      };
    });

    // Server-side total; any client-sent total is stripped by the schema.
    const total = calcItemsTotal(
      items.map((i) => ({ unitPrice: i.unitCost, quantity: i.quantity })),
    );

    await applyStockMovements(
      tx,
      items.map((item) => ({
        businessId,
        productId: item.productId,
        type: "purchase" as const,
        quantityDelta: item.quantity,
        reason: "Purchase",
        sourceRef: ref.id,
        actorId,
      })),
      db,
    );
    // Cost policy: product unit cost follows the latest purchase cost.
    items.forEach((item, index) => {
      tx.update(productRefs[index], {
        unitCost: item.unitCost,
        costUpdatedFromPurchaseDate: date,
        costUpdatedFromPurchaseId: ref.id,
      });
    });
    const doc = {
      businessId,
      supplierId: input.supplierId,
      supplierName: String(supplier.name ?? ""),
      date,
      items,
      total,
      notes: input.notes ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      createdBy: actorId,
      voidedAt: null,
      voidedBy: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, doc);
    return {
      purchase: serializePurchase(ref.id, { ...doc, createdAt: null }),
      created: true,
    };
  });
}

/**
 * Void a purchase: reversing movements (rejected with 409 if stock would go
 * negative) plus voidedAt/voidedBy. Nothing is deleted. products.unitCost is
 * left as is — it is only ever set by a newer purchase or manual edit.
 */
export async function voidPurchaseForBusiness(
  businessId: string,
  purchaseId: string,
  actorId: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  const ref = db.collection("purchases").doc(purchaseId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!snap.exists || !data || data.businessId !== businessId) {
      throw new ApiError(404, "Purchase not found.");
    }
    if (data.voidedAt) throw new ApiError(409, "This purchase is already voided.");
    const purchase = serializePurchase(snap.id, data);
    await applyStockMovements(
      tx,
      purchase.items.map((item) => ({
        businessId,
        productId: item.productId,
        type: "adjustment" as const,
        quantityDelta: -item.quantity,
        reason: "Void purchase",
        sourceRef: `void-${purchaseId}`,
        actorId,
      })),
      db,
    );
    tx.update(ref, { voidedAt: FieldValue.serverTimestamp(), voidedBy: actorId });
  });
}
