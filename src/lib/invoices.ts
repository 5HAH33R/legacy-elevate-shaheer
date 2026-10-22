import { z } from "zod";
import { multiplyMoney, parseMoney, sumMoney, type MinorUnits } from "./money";

/**
 * Invoice extraction results (SPEC 5.1). The AI reads the document; this
 * module turns what it returned into checked, integer-money data and lists
 * every missing, unclear or inconsistent field instead of guessing. Pure and
 * unit-tested; nothing here is trusted as a business record until the owner
 * confirms it.
 */

export const INVOICE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type InvoiceMimeType = (typeof INVOICE_MIME_TYPES)[number];

/** Kept under typical serverless request limits (about 4.5 MB). */
export const MAX_INVOICE_BYTES = 4 * 1024 * 1024;
export const MAX_INVOICE_LINES = 50;

/** Purchase = supplier bill (stock in). Sale = customer receipt (stock out). */
export const INVOICE_TYPES = ["purchase", "sale"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const PAYMENT_METHODS = ["cash", "online", "credit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Stored documents with no invoiceType predate sales receipts: they are purchases. */
export function resolveInvoiceType(value: unknown): InvoiceType {
  return value === "sale" ? "sale" : "purchase";
}

/** Strict parse for user input (form field / query string); null when absent or invalid. */
export function parseInvoiceType(value: unknown): InvoiceType | null {
  return value === "purchase" || value === "sale" ? value : null;
}

export function resolvePaymentMethod(value: unknown): PaymentMethod | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PAYMENT_METHODS as readonly string[]).includes(v) ? (v as PaymentMethod) : null;
}

const amount = z.union([z.string(), z.number()]).nullable().optional();
const text = z.string().nullable().optional();

/** What the model is asked to return; lenient, validated again below. */
export const rawExtractionSchema = z.object({
  isInvoice: z.boolean().optional(),
  supplierName: text,
  customerName: text,
  invoiceNumber: text,
  invoiceDate: text,
  currency: text,
  paymentMethod: text,
  lines: z
    .array(
      z.object({
        description: text,
        quantity: z.union([z.number(), z.string()]).nullable().optional(),
        unit: text,
        unitPrice: amount,
        lineTotal: amount,
        suggestedCategory: text,
      }),
    )
    .nullable()
    .optional(),
  subtotal: amount,
  tax: amount,
  discountAmount: amount,
  total: amount,
  /** Fields the model could not read. "unclear" is the older key, still accepted. */
  unclearFields: z.array(z.string()).nullable().optional(),
  unclear: z.array(z.string()).nullable().optional(),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

export type ExtractedInvoiceLine = {
  description: string;
  quantity: number | null;
  unit: string;
  unitPrice: MinorUnits | null;
  lineTotal: MinorUnits | null;
  /** Set by product matching (next phase); null until a product is matched. */
  matchedProductId: string | null;
  /** True when no product matched and the owner may add it as a new product. */
  isNewProduct?: boolean;
  suggestedCategory?: string | null;
  /** quantity × unitPrice agrees with lineTotal. Computed in app code, never by the AI. */
  arithmeticValid: boolean;
};
export type ExtractedLine = ExtractedInvoiceLine;

export type InvoiceIssue = { field: string; message: string };

export type ExtractedInvoice = {
  invoiceType: InvoiceType;
  isInvoice: boolean;
  /** Purchases: the seller. Always null for sales. */
  supplierName: string | null;
  /** Sales only. */
  customerName: string | null;
  /** Sales only. */
  paymentMethod: PaymentMethod | null;
  /** Sales only; integer minor units. */
  discountAmount: MinorUnits | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  lines: ExtractedInvoiceLine[];
  subtotal: MinorUnits | null;
  tax: MinorUnits | null;
  total: MinorUnits | null;
  unclearFields: string[];
  issues: InvoiceIssue[];
};

function cleanText(value: string | null | undefined, max = 200): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t === "" ? null : t.slice(0, max);
}

/**
 * "Rs. 1,250.50", "PKR 1250", 1250.5 → 125050. Anything that is not a clean,
 * non-negative amount with at most two decimals becomes null (and is flagged).
 */
export function parseInvoiceAmount(value: string | number | null | undefined): MinorUnits | null {
  if (value === null || value === undefined) return null;
  let s = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : value;
  s = s.replace(/(rs\.?|pkr|inr|usd|\$|₨)/gi, "").replace(/[\s,]/g, "").trim();
  if (s === "") return null;
  try {
    const minor = parseMoney(s);
    return minor >= 0 ? minor : null;
  } catch {
    return null;
  }
}

function parseQuantity(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Equal within one currency unit (printed invoices round line totals). */
function closeEnough(a: MinorUnits, b: MinorUnits): boolean {
  return Math.abs(a - b) <= 100;
}

/**
 * Deterministic line check: quantity × unitPrice equals the printed line total
 * (within one currency unit, since printed totals are rounded). A line that
 * cannot be checked (a value is missing or the quantity is fractional) is not
 * called wrong here; the missing value is flagged separately.
 */
export function isLineArithmeticValid(
  quantity: number | null,
  unitPrice: MinorUnits | null,
  lineTotal: MinorUnits | null,
): boolean {
  if (quantity === null || !Number.isInteger(quantity) || unitPrice === null || lineTotal === null) return true;
  return closeEnough(multiplyMoney(unitPrice, quantity), lineTotal);
}

/** Normalise the model's output and list every problem a person should check. */
export function normalizeExtraction(
  raw: RawExtraction,
  today: string,
  invoiceType: InvoiceType = "purchase",
): ExtractedInvoice {
  const issues: InvoiceIssue[] = [];
  const isSale = invoiceType === "sale";
  const isInvoice = raw.isInvoice !== false;
  if (!isInvoice) {
    issues.push({ field: "document", message: "This does not look like an invoice or bill. Check the file." });
  }

  // A sale has an optional customer (counter receipts often have none), not a supplier.
  const supplierName = isSale ? null : cleanText(raw.supplierName, 120);
  if (!isSale && !supplierName) issues.push({ field: "supplier", message: "Supplier name was not found." });
  const customerName = isSale ? cleanText(raw.customerName, 120) : null;
  const paymentMethod = isSale ? resolvePaymentMethod(raw.paymentMethod) : null;
  if (isSale && !paymentMethod) {
    issues.push({ field: "payment", message: "Payment type (cash, online or credit) was not found." });
  }
  const discountAmount = isSale ? parseInvoiceAmount(raw.discountAmount) : null;

  let invoiceDate = cleanText(raw.invoiceDate, 10);
  if (!invoiceDate) {
    issues.push({ field: "date", message: "Invoice date was not found." });
  } else if (!isRealDate(invoiceDate)) {
    issues.push({ field: "date", message: `Invoice date "${invoiceDate}" could not be read as a date.` });
    invoiceDate = null;
  } else if (invoiceDate > today) {
    issues.push({ field: "date", message: `Invoice date ${invoiceDate} is in the future. Check it.` });
  }

  const lines: ExtractedInvoiceLine[] = (raw.lines ?? []).slice(0, MAX_INVOICE_LINES).map((l, i) => {
    const n = i + 1;
    const description = cleanText(l.description, 120) ?? "";
    const quantity = parseQuantity(l.quantity);
    const unitPrice = parseInvoiceAmount(l.unitPrice);
    const lineTotal = parseInvoiceAmount(l.lineTotal);
    if (!description) issues.push({ field: `line ${n}`, message: `Line ${n}: item name was not found.` });
    if (quantity === null) {
      issues.push({ field: `line ${n}`, message: `Line ${n}: quantity was not found.` });
    } else if (!Number.isInteger(quantity)) {
      issues.push({
        field: `line ${n}`,
        message: `Line ${n}: quantity ${quantity} is not a whole number. Stock is recorded in whole units, so adjust the unit or quantity.`,
      });
    }
    if (unitPrice === null) issues.push({ field: `line ${n}`, message: `Line ${n}: unit price was not found.` });
    const arithmeticValid = isLineArithmeticValid(quantity, unitPrice, lineTotal);
    if (!arithmeticValid) {
      issues.push({
        field: `line ${n}`,
        message: `Line ${n}: quantity × unit price does not match the line total printed on the invoice.`,
      });
    }
    return {
      description,
      quantity,
      unit: cleanText(l.unit, 20) ?? "pcs",
      unitPrice,
      lineTotal,
      matchedProductId: null,
      suggestedCategory: cleanText(l.suggestedCategory, 60),
      arithmeticValid,
    };
  });
  if ((raw.lines ?? []).length > MAX_INVOICE_LINES) {
    issues.push({ field: "lines", message: `Only the first ${MAX_INVOICE_LINES} lines were kept.` });
  }
  if (lines.length === 0) issues.push({ field: "lines", message: "No item lines were found." });

  const subtotal = parseInvoiceAmount(raw.subtotal);
  const tax = parseInvoiceAmount(raw.tax);
  const total = parseInvoiceAmount(raw.total);
  if (total === null) issues.push({ field: "total", message: "Invoice total was not found." });

  const lineTotals = lines.map((l) => l.lineTotal);
  if (lines.length > 0 && lineTotals.every((t): t is MinorUnits => t !== null)) {
    const sum = sumMoney(lineTotals);
    const base = subtotal ?? (total !== null && tax !== null ? total - tax : total);
    // A sale's printed total is net of the discount, so compare against sum − discount.
    const expected = base !== null && subtotal === null && discountAmount !== null ? base + discountAmount : base;
    if (expected !== null && !closeEnough(sum, expected)) {
      issues.push({
        field: "total",
        message: "The line totals do not add up to the invoice subtotal/total. Some lines may be missing or misread.",
      });
    }
  }
  if (subtotal !== null && tax !== null && total !== null && discountAmount === null && !closeEnough(subtotal + tax, total)) {
    issues.push({ field: "total", message: "Subtotal plus tax does not equal the invoice total." });
  }

  const unclearFields: string[] = [];
  for (const u of [...(raw.unclearFields ?? []), ...(raw.unclear ?? [])]) {
    const t = cleanText(u, 160);
    if (t && !unclearFields.includes(t)) {
      unclearFields.push(t);
      issues.push({ field: "unclear", message: `The AI could not read clearly: ${t}` });
    }
  }

  return {
    invoiceType,
    isInvoice,
    supplierName,
    customerName,
    paymentMethod,
    discountAmount,
    invoiceNumber: cleanText(raw.invoiceNumber, 60),
    invoiceDate,
    currency: cleanText(raw.currency, 10),
    lines,
    subtotal,
    tax,
    total,
    unclearFields,
    issues,
  };
}

function words(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
}

/**
 * Suggest an existing record for an extracted name: exact match first, then
 * one name containing the other. Only a suggestion; the owner confirms it.
 */
export function suggestMatch<T extends { name: string }>(name: string, options: readonly T[]): T | null {
  const target = words(name);
  if (!target) return null;
  const exact = options.find((o) => words(o.name) === target);
  if (exact) return exact;
  const partial = options.filter((o) => {
    const n = words(o.name);
    return n.length >= 3 && (target.includes(n) || n.includes(target));
  });
  return partial.length === 1 ? partial[0] : null;
}
