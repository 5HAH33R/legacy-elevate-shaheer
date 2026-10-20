import "server-only";

import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError } from "./errors";
import { toIso, toNullableString } from "./serialize";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const contactSchema = z.object({
  phone: optionalText(40),
  email: optionalText(120),
  address: optionalText(240),
  notes: optionalText(500),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required.").max(120),
  contact: contactSchema.optional(),
});

export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(1, "Supplier name is required.").max(120).optional(),
    contact: contactSchema.optional(),
  })
  .refine((d) => d.name !== undefined || d.contact !== undefined, {
    message: "Nothing to update.",
  });

export type CreateSupplierInput = z.output<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>;

export type SupplierContact = {
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

/** SPEC.md 9.6. */
export type Supplier = {
  supplierId: string;
  businessId: string;
  name: string;
  contact: SupplierContact;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function cleanContact(contact: CreateSupplierInput["contact"]): SupplierContact {
  return {
    phone: contact?.phone || null,
    email: contact?.email || null,
    address: contact?.address || null,
    notes: contact?.notes || null,
  };
}

function serializeSupplier(id: string, data: DocumentData): Supplier {
  const c = (data.contact ?? {}) as Record<string, unknown>;
  return {
    supplierId: id,
    businessId: String(data.businessId ?? ""),
    name: String(data.name ?? ""),
    contact: {
      phone: toNullableString(c.phone),
      email: toNullableString(c.email),
      address: toNullableString(c.address),
      notes: toNullableString(c.notes),
    },
    archivedAt: toIso(data.archivedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/** Single-field query (no composite index); sorted in memory by name. */
export async function listSuppliersForBusiness(
  businessId: string,
  includeArchived = false,
  db: Firestore = getAdminDb(),
): Promise<Supplier[]> {
  const snapshot = await db
    .collection("suppliers")
    .where("businessId", "==", businessId)
    .get();
  return snapshot.docs
    .map((doc) => serializeSupplier(doc.id, doc.data()))
    .filter((s) => includeArchived || s.archivedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSupplierForBusiness(
  businessId: string,
  input: CreateSupplierInput,
  db: Firestore = getAdminDb(),
): Promise<Supplier> {
  const ref = db.collection("suppliers").doc();
  await ref.set({
    businessId,
    name: input.name,
    contact: cleanContact(input.contact),
    archivedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getSupplierForBusiness(businessId, ref.id, db);
}

export async function getSupplierForBusiness(
  businessId: string,
  supplierId: string,
  db: Firestore = getAdminDb(),
): Promise<Supplier> {
  const snap = await db.collection("suppliers").doc(supplierId).get();
  const data = snap.data();
  if (!snap.exists || !data || data.businessId !== businessId) {
    throw new ApiError(404, "Supplier not found.");
  }
  return serializeSupplier(snap.id, data);
}

export async function updateSupplierForBusiness(
  businessId: string,
  supplierId: string,
  input: UpdateSupplierInput,
  db: Firestore = getAdminDb(),
): Promise<Supplier> {
  await getSupplierForBusiness(businessId, supplierId, db);
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.contact !== undefined) updates.contact = cleanContact(input.contact);
  await db.collection("suppliers").doc(supplierId).update(updates);
  return getSupplierForBusiness(businessId, supplierId, db);
}

/** Archive only; suppliers are never hard-deleted (purchases reference them). */
export async function archiveSupplierForBusiness(
  businessId: string,
  supplierId: string,
  db: Firestore = getAdminDb(),
): Promise<void> {
  await getSupplierForBusiness(businessId, supplierId, db);
  await db.collection("suppliers").doc(supplierId).update({
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
