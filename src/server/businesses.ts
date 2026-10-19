import "server-only";

import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError } from "./errors";

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(120),
  businessType: z.string().trim().max(120).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as PKR.")
    .default("PKR"),
});

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    businessType: z.string().trim().max(120).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as PKR.")
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Nothing to update.",
  });

export type CreateBusinessInput = z.output<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.output<typeof updateBusinessSchema>;

/** SPEC.md 9.2. Timestamps are serialized to ISO strings for the client. */
export type Business = {
  businessId: string;
  ownerId: string;
  name: string;
  businessType: string | null;
  currency: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function toIso(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function serializeBusiness(id: string, data: DocumentData): Business {
  return {
    businessId: id,
    ownerId: String(data.ownerId ?? ""),
    name: String(data.name ?? ""),
    businessType:
      typeof data.businessType === "string" && data.businessType !== ""
        ? data.businessType
        : null,
    currency: String(data.currency ?? "PKR"),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/** All workspaces owned by this user. Query filters by ownerId only, so no composite index is needed. */
export async function listBusinessesForUser(
  uid: string,
  db: Firestore = getAdminDb(),
): Promise<Business[]> {
  const snapshot = await db
    .collection("businesses")
    .where("ownerId", "==", uid)
    .get();
  return snapshot.docs.map((doc) => serializeBusiness(doc.id, doc.data()));
}

/**
 * Create businesses/{businessId} (SPEC.md 9.2). ownerId comes from the
 * verified session passed by the caller — never from request data.
 */
export async function createBusinessForUser(
  uid: string,
  input: CreateBusinessInput,
  db: Firestore = getAdminDb(),
): Promise<Business> {
  const ref = db.collection("businesses").doc();
  const data = {
    ownerId: uid,
    name: input.name,
    businessType: input.businessType ?? null,
    currency: input.currency,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(data);
  return {
    businessId: ref.id,
    ownerId: uid,
    name: input.name,
    businessType: input.businessType ?? null,
    currency: input.currency,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Load a business and prove the session user owns it. Every business-data
 * route must go through this. Responds 404 in every failure case so other
 * users cannot tell whether a businessId exists (AGENTS.md section 8).
 */
export async function requireBusinessOwner(
  uid: string,
  businessId: string,
  db: Firestore = getAdminDb(),
): Promise<Business> {
  const snapshot = await db.collection("businesses").doc(businessId).get();
  if (!snapshot.exists) throw new ApiError(404, "Business not found.");
  const data = snapshot.data();
  if (!data || data.ownerId !== uid) {
    throw new ApiError(404, "Business not found.");
  }
  return serializeBusiness(snapshot.id, data);
}

export async function updateBusinessForOwner(
  uid: string,
  businessId: string,
  input: UpdateBusinessInput,
  db: Firestore = getAdminDb(),
): Promise<Business> {
  await requireBusinessOwner(uid, businessId, db);
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.businessType !== undefined)
    updates.businessType = input.businessType;
  if (input.currency !== undefined) updates.currency = input.currency;
  await db.collection("businesses").doc(businessId).update(updates);
  return requireBusinessOwner(uid, businessId, db);
}
