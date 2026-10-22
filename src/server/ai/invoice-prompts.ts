import { MAX_INVOICE_LINES, type InvoiceType } from "@/lib/invoices";

/**
 * Type-specific prompts for document reading (extractDocumentJson). Both
 * share the same grounding rules: only what is printed, never guess, never
 * calculate, null + "unclearFields" for anything blurred, torn or doubtful.
 * Arithmetic checks and product matching are done in app code, not here.
 */
const GROUNDING = `Extract only what is physically printed or written on the document.
Never guess, never calculate missing values, never invent items, names, prices or dates.
If a value is blurred, torn, smudged, cut off, unreadable or you are unsure, set it to null and add a short note naming it to "unclearFields" (for example "Line 3 unit price is smudged").
The document may be in English, Urdu or a mix, and may be a photo of a handwritten slip.`;

const SYSTEM_PURCHASE = `You read supplier invoices and bills for small shops in Pakistan. The shop is the BUYER; the document comes from a supplier or wholesaler.
${GROUNDING}`;

const SYSTEM_SALE = `You read customer sales receipts and counter slips issued by a small shop in Pakistan. The shop is the SELLER; the items were sold to a customer.
${GROUNDING}`;

const LINE_SHAPE = (priceLabel: string) => `{
      "description": string (item name as printed),
      "quantity": number | null,
      "unit": string | null (e.g. "pcs", "kg", "box", "carton"),
      "unitPrice": string | null (${priceLabel}, digits and optional decimal point, no currency sign),
      "lineTotal": string | null (amount for the line as printed),
      "suggestedCategory": string | null (a short generic product category such as "Grocery" or "Beverages", only if obvious from the item name)
    }`;

const INSTRUCTION_PURCHASE = `Return ONLY a JSON object with exactly these keys:
{
  "isInvoice": boolean (false if this is not an invoice/bill/receipt),
  "supplierName": string | null (the vendor / company that issued the bill),
  "invoiceNumber": string | null (the bill number),
  "invoiceDate": string | null (format YYYY-MM-DD; null if not printed or unclear),
  "currency": string | null (e.g. "PKR"),
  "lines": [
    ${LINE_SHAPE("wholesale cost per unit as printed")}
  ],
  "subtotal": string | null,
  "tax": string | null (total tax/GST if printed),
  "total": string | null (grand total as printed),
  "unclearFields": string[] (short notes on anything you could not read with confidence)
}
List at most ${MAX_INVOICE_LINES} lines, in the order printed. Do not include discounts or delivery as item lines; mention them in "unclearFields" instead.`;

const INSTRUCTION_SALE = `Return ONLY a JSON object with exactly these keys:
{
  "isInvoice": boolean (false if this is not a receipt/sales slip/bill),
  "customerName": string | null (the buyer, only if written; counter receipts often have none),
  "invoiceNumber": string | null (the receipt or bill number),
  "invoiceDate": string | null (format YYYY-MM-DD; null if not printed or unclear),
  "currency": string | null (e.g. "PKR"),
  "paymentMethod": "cash" | "online" | "credit" | null (only if the payment type is written or clearly marked, otherwise null),
  "lines": [
    ${LINE_SHAPE("retail price per unit charged to the customer, as printed")}
  ],
  "subtotal": string | null,
  "discountAmount": string | null (total discount in money, only if printed),
  "tax": string | null (total tax/GST if printed),
  "total": string | null (amount the customer paid / grand total as printed),
  "unclearFields": string[] (short notes on anything you could not read with confidence)
}
List at most ${MAX_INVOICE_LINES} lines, in the order printed. Do not include discounts as item lines; use "discountAmount".`;

export function invoicePrompt(type: InvoiceType): { system: string; instruction: string } {
  return type === "sale"
    ? { system: SYSTEM_SALE, instruction: INSTRUCTION_SALE }
    : { system: SYSTEM_PURCHASE, instruction: INSTRUCTION_PURCHASE };
}
