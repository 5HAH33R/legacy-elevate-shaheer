import "server-only";

import {
  FieldValue,
  type DocumentData,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError } from "./errors";
import { toIso, toNullableString, toNumber } from "./serialize";

export const MOVEMENT_TYPES = [
  "opening",
  "sale",
  "purchase",
  "adjustment",
  "return",
  "damage",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Stock adjustment: signed whole-number change and a mandatory reason. */
export const adjustStockSchema = z.object({
  quantityDelta: z
    .number()
    .int("Change must be a whole number.")
    .refine((v) => v !== 0, "Change cannot be zero.")
    .refine((v) => Math.abs(v) <= 1_000_000, "Change is too large."),
  reason: z.string().trim().min(1, "A reason is required.").max(240),
});
export type AdjustStockInput = z.output<typeof adjustStockSchema>;

export type StockMovementInput = {
  businessId: string;
  productId: string;
  type: MovementType;
  quantityDelta: number;
  reason?: string | null;
  sourceRef?: string | null;
  actorId?: string | null;
};

export type InventoryMovement = {
  movementId: string;
  businessId: string;
  productId: string;
  type: MovementType;
  quantityDelta: number;
  quantityAfter: number;
  reason: string | null;
  sourceRef: string | null;
  actorId: string | null;
  createdAt: string | null;
};

function movementRef(db: Firestore, m: StockMovementInput) {
  const col = db.collection("inventoryMovements");
  // Deterministic id makes a replay overwrite itself rather than duplicate.
  return m.sourceRef ? col.doc(`${m.sourceRef}_${m.productId}_${m.type}`) : col.doc();
}

/**
 * Apply stock movements inside the caller's transaction: all product reads
 * first, then validate businessId and non-negative stock, then update
 * products.quantity and write one movement doc per change. Multiple movements
 * for one product are applied cumulatively.
 */
export async function applyStockMovements(
  tx: Transaction,
  movements: StockMovementInput[],
  db: Firestore = getAdminDb(),
): Promise<void> {
  const ids = [...new Set(movements.map((m) => m.productId))];
  const refs = new Map(ids.map((id) => [id, db.collection("products").doc(id)]));
  const snaps = await Promise.all(ids.map((id) => tx.get(refs.get(id)!)));
  const levels = new Map<string, number>();
  const names = new Map<string, string>();
  snaps.forEach((snap, i) => {
    const data = snap.data();
    levels.set(ids[i], toNumber(data?.quantity));
    names.set(ids[i], String(data?.name ?? "product"));
    // Stash existence/business for validation below.
    (levels as Map<string, number>).set(`ok:${ids[i]}`, snap.exists && data ? 1 : 0);
    names.set(`biz:${ids[i]}`, String(data?.businessId ?? ""));
  });

  const writes: { m: StockMovementInput; after: number }[] = [];
  for (const m of movements) {
    if (levels.get(`ok:${m.productId}`) !== 1 || names.get(`biz:${m.productId}`) !== m.businessId) {
      throw new ApiError(400, "One of the products does not belong to this business.");
    }
    const after = (levels.get(m.productId) ?? 0) + m.quantityDelta;
    if (after < 0) {
      throw new ApiError(
        409,
        `Not enough stock for "${names.get(m.productId)}" (${levels.get(m.productId)} left).`,
      );
    }
    levels.set(m.productId, after);
    writes.push({ m, after });
  }

  for (const id of ids) {
    tx.update(refs.get(id)!, {
      quantity: levels.get(id),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  for (const { m, after } of writes) {
    tx.set(movementRef(db, m), {
      businessId: m.businessId,
      productId: m.productId,
      type: m.type,
      quantityDelta: m.quantityDelta,
      quantityAfter: after,
      reason: m.reason ?? null,
      sourceRef: m.sourceRef ?? null,
      actorId: m.actorId ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Write the opening movement for a brand-new product (doc written by caller). */
export function writeOpeningMovement(
  tx: Transaction,
  db: Firestore,
  m: { businessId: string; productId: string; quantity: number; actorId?: string | null },
): void {
  tx.set(db.collection("inventoryMovements").doc(`opening_${m.productId}`), {
    businessId: m.businessId,
    productId: m.productId,
    type: "opening",
    quantityDelta: m.quantity,
    quantityAfter: m.quantity,
    reason: "Opening stock",
    sourceRef: m.productId,
    actorId: m.actorId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Manual stock adjustment (reason required by schema) as one movement. */
export async function adjustStockForBusiness(
  businessId: string,
  productId: string,
  input: AdjustStockInput,
  actorId: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  await db.runTransaction(async (tx) => {
    await applyStockMovements(
      tx,
      [
        {
          businessId,
          productId,
          type: "adjustment",
          quantityDelta: input.quantityDelta,
          reason: input.reason,
          actorId,
        },
      ],
      db,
    );
  });
}

function serializeMovement(id: string, data: DocumentData): InventoryMovement {
  return {
    movementId: id,
    businessId: String(data.businessId ?? ""),
    productId: String(data.productId ?? ""),
    type: data.type as MovementType,
    quantityDelta: toNumber(data.quantityDelta),
    quantityAfter: toNumber(data.quantityAfter),
    reason: toNullableString(data.reason),
    sourceRef: toNullableString(data.sourceRef),
    actorId: toNullableString(data.actorId),
    createdAt: toIso(data.createdAt),
  };
}

/** Movement history for one product; single-field query, filtered in memory. */
export async function listMovementsForProduct(
  businessId: string,
  productId: string,
  db: Firestore = getAdminDb(),
): Promise<InventoryMovement[]> {
  const snapshot = await db
    .collection("inventoryMovements")
    .where("businessId", "==", businessId)
    .get();
  return snapshot.docs
    .map((doc) => serializeMovement(doc.id, doc.data()))
    .filter((m) => m.productId === productId)
    .sort((a, b) => (b.createdAt ?? "9").localeCompare(a.createdAt ?? "9"));
}
