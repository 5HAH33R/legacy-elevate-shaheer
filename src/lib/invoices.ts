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

const amount = z.union([z.string(), z.number()]).nullable().optional();
const text = z.string().nullable().optional();

/** What the model is asked to return; lenient, validated again below. */
export const rawExtractionSchema = z.object({
  isInvoice: z.boolean().optional(),
  supplierName: text,
  invoiceNumber: text,
  invoiceDate: text,
  currency: text,
  lines: z
    .array(
      z.object({
        description: text,
        quantity: z.union([z.number(), z.string()]).nullable().optional(),
        unit: text,
        unitPrice: amount,
        lineTotal: amount,
      }),
    )
    .nullable()
    .optional(),
  subtotal: amount,
  tax: amount,
  total: amount,
  unclear: z.array(z.string()).nullable().optional(),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

export type ExtractedLine = {
  description: string;
  quantity: number | null;
  unit: string;
  unitPrice: MinorUnits | null;
  lineTotal: MinorUnits | null;
};

export type InvoiceIssue = { field: string; message: string };

export type ExtractedInvoice = {
  isInvoice: boolean;
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  lines: ExtractedLine[];
  subtotal: MinorUnits | null;
  tax: MinorUnits | null;
  total: MinorUnits | null;
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

/** Normalise the model's output and list every problem a person should check. */
export function normalizeExtraction(raw: RawExtraction, today: string): ExtractedInvoice {
  const issues: InvoiceIssue[] = [];
  const isInvoice = raw.isInvoice !== false;
  if (!isInvoice) {
    issues.push({ field: "document", message: "This does not look like an invoice or bill. Check the file." });
  }

  const supplierName = cleanText(raw.supplierName, 120);
  if (!supplierName) issues.push({ field: "supplier", message: "Supplier name was not found." });

  let invoiceDate = cleanText(raw.invoiceDate, 10);
  if (!invoiceDate) {
    issues.push({ field: "date", message: "Invoice date was not found." });
  } else if (!isRealDate(invoiceDate)) {
    issues.push({ field: "date", message: `Invoice date "${invoiceDate}" could not be read as a date.` });
    invoiceDate = null;
  } else if (invoiceDate > today) {
    issues.push({ field: "date", message: `Invoice date ${invoiceDate} is in the future. Check it.` });
  }

  const lines: ExtractedLine[] = (raw.lines ?? []).slice(0, MAX_INVOICE_LINES).map((l, i) => {
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
        message: `Line ${n}: quantity ${quantity} is not a whole number. Purchases are recorded in whole units, so adjust the unit or quantity.`,
      });
    }
    if (unitPrice === null) issues.push({ field: `line ${n}`, message: `Line ${n}: unit price was not found.` });
    if (quantity !== null && Number.isInteger(quantity) && unitPrice !== null && lineTotal !== null) {
      const expected = multiplyMoney(unitPrice, quantity);
      if (!closeEnough(expected, lineTotal)) {
        issues.push({
          field: `line ${n}`,
          message: `Line ${n}: quantity × unit price does not match the line total printed on the invoice.`,
        });
      }
    }
    return { description, quantity, unit: cleanText(l.unit, 20) ?? "pcs", unitPrice, lineTotal };
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
    if (base !== null && !closeEnough(sum, base)) {
      issues.push({
        field: "total",
        message: "The line totals do not add up to the invoice subtotal/total. Some lines may be missing or misread.",
      });
    }
  }
  if (subtotal !== null && tax !== null && total !== null && !closeEnough(subtotal + tax, total)) {
    issues.push({ field: "total", message: "Subtotal plus tax does not equal the invoice total." });
  }
  for (const u of raw.unclear ?? []) {
    const t = cleanText(u, 160);
    if (t) issues.push({ field: "unclear", message: `The AI could not read clearly: ${t}` });
  }

  return {
    isInvoice,
    supplierName,
    invoiceNumber: cleanText(raw.invoiceNumber, 60),
    invoiceDate,
    currency: cleanText(raw.currency, 10),
    lines,
    subtotal,
    tax,
    total,
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

