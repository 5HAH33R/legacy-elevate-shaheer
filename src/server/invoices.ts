import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { getAiConfig } from "@/lib/env/server";
import { todayInTimeZone } from "@/lib/dates";
import {
  INVOICE_MIME_TYPES,
  MAX_INVOICE_BYTES,
  MAX_INVOICE_LINES,
  normalizeExtraction,
  rawExtractionSchema,
  resolveInvoiceType,
  resolvePaymentMethod,
  type ExtractedInvoice,
  type InvoiceMimeType,
  type InvoiceType,
} from "@/lib/invoices";
import { dateField, moneyField } from "@/lib/validation";
import type { Business } from "./businesses";
import { ApiError } from "./errors";
import { consumeDailyAiUse } from "./ai/conversations";
import { invoicePrompt } from "./ai/invoice-prompts";
import { AiError, extractDocumentJson } from "./ai/provider";
import { recordPurchaseForBusiness, type Purchase } from "./purchases";
import { createSupplierForBusiness } from "./suppliers";

/**
 * Smart invoice analysis (SPEC 5.1, 9.8). The uploaded file is sent once to
 * the AI service to read it and is NOT stored (filePath stays null), so no
 * file can ever be public. What the AI read is saved as `extractedData` with
 * reviewStatus "needs_review"; it only becomes a business record (a purchase
 * that adds stock) when the owner confirms the reviewed lines. Each invoice
 * is a "purchase" (supplier bill) or a "sale" (customer receipt); documents
 * without the field are purchases. Callers MUST have run requireUser() →
 * requireBusinessOwner(businessId) first.
 */
export type InvoiceStatus = "needs_review" | "confirmed" | "discarded";

export type Invoice = {
  invoiceId: string;
  businessId: string;
  /** Missing on older documents; those are purchases. */
  invoiceType: InvoiceType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  filePath: null;
  reviewStatus: InvoiceStatus;
  extractedData: ExtractedInvoice;
  invoiceDate: string | null;
  supplierId: string | null;
  purchaseId: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

const COLLECTION = "invoices";

export const confirmInvoiceSchema = z
  .object({
    purchaseId: z.string().uuid("Invalid purchase id."),
    supplierId: z.string().trim().min(1).max(120).optional(),
    newSupplierName: z.string().trim().min(1, "Supplier name is required.").max(120).optional(),
    date: dateField,
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1, "Choose a product for every line you keep."),
          quantity: z
            .number()
            .int("Quantity must be a whole number.")
            .min(1, "Quantity must be at least 1.")
            .max(1_000_000, "Quantity is too large."),
          unit: z.string().trim().min(1).max(20).default("pcs"),
          unitCost: moneyField("Unit cost"),
        }),
      )
      .min(1, "Keep at least one line to record the purchase.")
      .max(MAX_INVOICE_LINES),
  })
  .refine((d) => Boolean(d.supplierId) !== Boolean(d.newSupplierName), {
    message: "Choose an existing supplier or enter a new supplier name.",
  });
export type ConfirmInvoiceInput = z.output<typeof confirmInvoiceSchema>;

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function serializeInvoice(id: string, data: DocumentData): Invoice {
  const status = data.reviewStatus === "confirmed" || data.reviewStatus === "discarded" ? data.reviewStatus : "needs_review";
  const extracted = (data.extractedData ?? {}) as Partial<ExtractedInvoice>;
  const invoiceType = resolveInvoiceType(data.invoiceType ?? extracted.invoiceType);
  const lines = Array.isArray(extracted.lines) ? extracted.lines : [];
  return {
    invoiceId: id,
    businessId: String(data.businessId ?? ""),
    invoiceType,
    fileName: String(data.fileName ?? "invoice"),
    mimeType: String(data.mimeType ?? ""),
    fileSize: typeof data.fileSize === "number" ? data.fileSize : 0,
    filePath: null,
    reviewStatus: status,
    extractedData: {
      invoiceType,
      isInvoice: extracted.isInvoice !== false,
      supplierName: extracted.supplierName ?? null,
      customerName: extracted.customerName ?? null,
      paymentMethod: resolvePaymentMethod(extracted.paymentMethod),
      discountAmount: typeof extracted.discountAmount === "number" ? extracted.discountAmount : null,
      invoiceNumber: extracted.invoiceNumber ?? null,
      invoiceDate: extracted.invoiceDate ?? null,
      currency: extracted.currency ?? null,
      // Older lines lack the Phase 1 fields; default them rather than migrate.
      lines: lines.map((l) => ({
        ...l,
        matchedProductId: l.matchedProductId ?? null,
        arithmeticValid: l.arithmeticValid !== false,
      })),
      subtotal: extracted.subtotal ?? null,
      tax: extracted.tax ?? null,
      total: extracted.total ?? null,
      unclearFields: Array.isArray(extracted.unclearFields) ? extracted.unclearFields : [],
      issues: Array.isArray(extracted.issues) ? extracted.issues : [],
    },
    invoiceDate: str(data.invoiceDate),
    supplierId: str(data.supplierId),
    purchaseId: str(data.purchaseId),
    model: str(data.model),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    confirmedAt: str(data.confirmedAt),
  };
}

/** Check the real file type from its first bytes, not only the browser's label. */
export function sniffMimeType(bytes: Uint8Array): InvoiceMimeType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

/** The model is asked for bare JSON; tolerate a ```json fence around it. */
function parseModelJson(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    return null;
  }
}

const AI_ERROR_STATUS: Record<AiError["kind"], number> = {
  "rate-limited": 429,
  blocked: 422,
  unavailable: 503,
  "invalid-response": 502,
};

/**
 * Read an uploaded invoice with the AI and save the result for review.
 * `invoiceType` picks the prompt (supplier bill vs customer receipt) and
 * defaults to purchase. Writes only the `invoices` and `aiUsage` collections.
 */
export async function scanInvoiceForBusiness(
  input: {
    uid: string;
    business: Business;
    fileName: string;
    declaredType: string;
    bytes: Uint8Array;
    invoiceType?: InvoiceType;
  },
  db: Firestore = getAdminDb(),
): Promise<Invoice> {
  const { uid, business, bytes } = input;
  const invoiceType = input.invoiceType ?? "purchase";
  if (bytes.byteLength === 0) throw new ApiError(400, "The file is empty.");
  if (bytes.byteLength > MAX_INVOICE_BYTES) {
    throw new ApiError(413, `The file is too large. Upload a file under ${MAX_INVOICE_BYTES / 1024 / 1024} MB.`);
  }
  const mimeType = sniffMimeType(bytes);
  if (!mimeType || !(INVOICE_MIME_TYPES as readonly string[]).includes(input.declaredType)) {
    throw new ApiError(415, "Upload a JPG, PNG or WebP photo, or a PDF.");
  }

  const config = getAiConfig();
  if (!config) {
    throw new ApiError(503, "Invoice reading needs the AI service, which is not configured yet.");
  }
  const today = todayInTimeZone(business.timezone);
  await consumeDailyAiUse(uid, today, config.AI_INVOICE_DAILY_LIMIT, "invoices", db);

  const prompt = invoicePrompt(invoiceType);
  let answer;
  try {
    answer = await extractDocumentJson(config, {
      system: prompt.system,
      instruction: prompt.instruction,
      mimeType,
      base64: Buffer.from(bytes).toString("base64"),
    });
  } catch (error) {
    if (error instanceof AiError) {
      const message =
        error.kind === "blocked"
          ? "The AI service declined to read this file. Check that it is an invoice."
          : error.kind === "invalid-response"
            ? "The AI service could not read this invoice clearly. Try a sharper, well-lit photo."
            : error.message;
      throw new ApiError(AI_ERROR_STATUS[error.kind], message);
    }
    throw error;
  }

  const raw = rawExtractionSchema.safeParse(parseModelJson(answer.text));
  if (!raw.success) {
    throw new ApiError(502, "The AI service could not read this invoice clearly. Try a sharper, well-lit photo.");
  }
  const extracted = normalizeExtraction(raw.data, today, invoiceType);
  if (answer.truncated) {
    extracted.issues.push({ field: "lines", message: "The invoice was very long; some lines may be missing. Check against the paper copy." });
  }

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTION).doc();
  const doc = {
    businessId: business.businessId,
    uploadedBy: uid,
    invoiceType,
    fileName: input.fileName.slice(0, 120) || "invoice",
    mimeType,
    fileSize: bytes.byteLength,
    filePath: null,
    reviewStatus: "needs_review" as const,
    extractedData: extracted,
    invoiceDate: extracted.invoiceDate,
    supplierId: null,
    purchaseId: null,
    createdSupplierId: null,
    model: answer.model,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    confirmedBy: null,
  };
  await ref.set(doc);
  return serializeInvoice(ref.id, doc);
}

/** Newest first; single-field businessId query, sorted in memory. */
export async function listInvoicesForBusiness(
  businessId: string,
  db: Firestore = getAdminDb(),
): Promise<Invoice[]> {
  const snapshot = await db.collection(COLLECTION).where("businessId", "==", businessId).get();
  return snapshot.docs
    .map((d) => serializeInvoice(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 404 unless the invoice belongs to this business. */
export async function getInvoiceForBusiness(
  businessId: string,
  invoiceId: string,
  db: Firestore = getAdminDb(),
): Promise<Invoice> {
  const snap = await db.collection(COLLECTION).doc(invoiceId).get();
  const data = snap.data();
  if (!snap.exists || !data || data.businessId !== businessId) {
    throw new ApiError(404, "Invoice not found.");
  }
  return serializeInvoice(snap.id, data);
}

/** Discard an unconfirmed scan. It stays listed as discarded; nothing else changes. */
export async function discardInvoiceForBusiness(
  businessId: string,
  invoiceId: string,
  db: Firestore = getAdminDb(),
): Promise<Invoice> {
  const invoice = await getInvoiceForBusiness(businessId, invoiceId, db);
  if (invoice.reviewStatus === "confirmed") {
    throw new ApiError(
      409,
      invoice.invoiceType === "sale"
        ? "This invoice is already recorded as a sale."
        : "This invoice is already recorded as a purchase. Void the purchase instead.",
    );
  }
  if (invoice.reviewStatus === "needs_review") {
    await db.collection(COLLECTION).doc(invoiceId).update({ reviewStatus: "discarded", updatedAt: new Date().toISOString() });
  }
  return { ...invoice, reviewStatus: "discarded" };
}

/**
 * Turn the owner-reviewed lines into a purchase (stock goes up, product costs
 * follow the purchase, sourceDocumentId links back here). Idempotent on the
 * client purchaseId, and a new supplier is created at most once per invoice.
 * Sale invoices are confirmed by a later phase; they are refused here.
 */
export async function confirmInvoiceForBusiness(
  input: { business: Business; uid: string; invoiceId: string; data: ConfirmInvoiceInput },
  db: Firestore = getAdminDb(),
): Promise<{ invoice: Invoice; purchase: Purchase }> {
  const { business, uid, invoiceId, data } = input;
  const businessId = business.businessId;
  const ref = db.collection(COLLECTION).doc(invoiceId);
  const snap = await ref.get();
  const stored = snap.data();
  if (!snap.exists || !stored || stored.businessId !== businessId) {
    throw new ApiError(404, "Invoice not found.");
  }
  const invoice = serializeInvoice(snap.id, stored);
  if (invoice.invoiceType === "sale") {
    throw new ApiError(400, "Confirming a sales receipt is not available yet.");
  }
  if (invoice.reviewStatus === "discarded") {
    throw new ApiError(409, "This invoice was discarded. Upload it again to record it.");
  }
  if (invoice.reviewStatus === "confirmed" && invoice.purchaseId !== data.purchaseId) {
    throw new ApiError(409, "This invoice is already recorded as a purchase.");
  }

  let supplierId = data.supplierId ?? null;
  if (!supplierId) {
    const created = str(stored.createdSupplierId);
    if (created) {
      supplierId = created;
    } else {
      const supplier = await createSupplierForBusiness(businessId, { name: data.newSupplierName! }, db);
      supplierId = supplier.supplierId;
      await ref.update({ createdSupplierId: supplierId, updatedAt: new Date().toISOString() });
    }
  }

  const { purchase } = await recordPurchaseForBusiness(
    businessId,
    {
      purchaseId: data.purchaseId,
      supplierId,
      date: data.date,
      items: data.items,
      notes: invoice.extractedData.invoiceNumber
        ? `Invoice ${invoice.extractedData.invoiceNumber}`
        : "Recorded from a scanned invoice",
      sourceDocumentId: invoiceId,
    },
    uid,
    business.timezone,
    db,
  );

  const now = new Date().toISOString();
  const update = {
    reviewStatus: "confirmed" as const,
    purchaseId: purchase.purchaseId,
    supplierId,
    invoiceDate: data.date,
    confirmedAt: invoice.confirmedAt ?? now,
    confirmedBy: uid,
    updatedAt: now,
  };
  await ref.update(update);
  return { invoice: serializeInvoice(invoiceId, { ...stored, ...update }), purchase };
}
