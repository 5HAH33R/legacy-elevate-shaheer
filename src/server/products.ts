import "server-only";

import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { MinorUnits } from "@/lib/money";
import { countField, moneyField } from "@/lib/validation";
import { ApiError } from "./errors";
import { writeOpeningMovement } from "./inventory";
import { toIso, toNullableString, toNumber } from "./serialize";

const nameField = z.string().trim().min(1, "Product name is required.").max(120);
const skuField = z.string().trim().max(60).optional();

export const createProductSchema = z.object({
  name: nameField,
  sku: skuField,
  quantity: countField("Stock quantity"),
  unitCost: moneyField("Unit cost"),
  sellingPrice: moneyField("Selling price"),
  reorderLevel: countField("Reorder level").optional(),
});

export const updateProductSchema = z
  .object({
    name: nameField.optional(),
    sku: z.string().trim().max(60).nullable().optional(),
    unitCost: moneyField("Unit cost").optional(),
    sellingPrice: moneyField("Selling price").optional(),
    reorderLevel: countField("Reorder level").nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Nothing to update.",
  });

export type CreateProductInput = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.output<typeof updateProductSchema>;

/** SPEC.md 9.3. Money is integer minor units; timestamps serialized to ISO. */
export type Product = {
  productId: string;
  businessId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost: MinorUnits;
  sellingPrice: MinorUnits;
  reorderLevel: number | null;
  /** Cost provenance: set when a purchase last updated unitCost (Phase 4). */
  costUpdatedFromPurchaseDate: string | null;
  costUpdatedFromPurchaseId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function serializeProduct(id: string, data: DocumentData): Product {
  return {
    productId: id,
    businessId: String(data.businessId ?? ""),
    name: String(data.name ?? ""),
    sku: toNullableString(data.sku),
    quantity: toNumber(data.quantity),
    unitCost: toNumber(data.unitCost),
    sellingPrice: toNumber(data.sellingPrice),
    reorderLevel:
      typeof data.reorderLevel === "number" ? data.reorderLevel : null,
    costUpdatedFromPurchaseDate: toNullableString(data.costUpdatedFromPurchaseDate),
    costUpdatedFromPurchaseId: toNullableString(data.costUpdatedFromPurchaseId),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/** Single-field query (no composite index); sorted in memory by name. */
export async function listProductsForBusiness(
  businessId: string,
  db: Firestore = getAdminDb(),
): Promise<Product[]> {
  const snapshot = await db
    .collection("products")
    .where("businessId", "==", businessId)
    .get();
  return snapshot.docs
    .map((doc) => serializeProduct(doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProductForBusiness(
  businessId: string,
  input: CreateProductInput,
  actorId: string | null = null,
  db: Firestore = getAdminDb(),
): Promise<Product> {
  const ref = db.collection("products").doc();
  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      businessId,
      name: input.name,
      sku: input.sku ?? null,
      quantity: input.quantity,
      unitCost: input.unitCost,
      sellingPrice: input.sellingPrice,
      reorderLevel: input.reorderLevel ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeOpeningMovement(tx, db, {
      businessId,
      productId: ref.id,
      quantity: input.quantity,
      actorId,
    });
  });
  return {
    productId: ref.id,
    businessId,
    name: input.name,
    sku: input.sku ?? null,
    quantity: input.quantity,
    unitCost: input.unitCost,
    sellingPrice: input.sellingPrice,
    reorderLevel: input.reorderLevel ?? null,
    costUpdatedFromPurchaseDate: null,
    costUpdatedFromPurchaseId: null,
    createdAt: null,
    updatedAt: null,
  };
}

/** Load a product only if it belongs to the business; 404 otherwise. */
export async function getProductForBusiness(
  businessId: string,
  productId: string,
  db: Firestore = getAdminDb(),
): Promise<Product> {
  const snapshot = await db.collection("products").doc(productId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.businessId !== businessId) {
    throw new ApiError(404, "Product not found.");
  }
  return serializeProduct(snapshot.id, data);
}

export async function updateProductForBusiness(
  businessId: string,
  productId: string,
  input: UpdateProductInput,
  db: Firestore = getAdminDb(),
): Promise<Product> {
  await getProductForBusiness(businessId, productId, db);
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.sku !== undefined) updates.sku = input.sku;
  if (input.unitCost !== undefined) updates.unitCost = input.unitCost;
  if (input.sellingPrice !== undefined) updates.sellingPrice = input.sellingPrice;
  if (input.reorderLevel !== undefined) updates.reorderLevel = input.reorderLevel;
  await db.collection("products").doc(productId).update(updates);
  return getProductForBusiness(businessId, productId, db);
}
