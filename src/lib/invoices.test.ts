import { describe, expect, it } from "vitest";
import { normalizeExtraction, parseInvoiceAmount, suggestMatch, type RawExtraction } from "./invoices";

const TODAY = "2026-10-22";

function clean(over: Partial<RawExtraction> = {}): RawExtraction {
  return {
    isInvoice: true,
    supplierName: "Al-Madina Traders",
    invoiceNumber: "INV-104",
    invoiceDate: "2026-10-20",
    currency: "PKR",
    lines: [
      { description: "Cooking oil 5L", quantity: 10, unit: "pcs", unitPrice: "1,480.00", lineTotal: "14,800.00" },
      { description: "Sugar 1kg", quantity: 20, unit: "kg", unitPrice: "150", lineTotal: "3000" },
    ],
    subtotal: "17800",
    tax: "0",
    total: "17,800",
    unclear: [],
    ...over,
  };
}

describe("parseInvoiceAmount", () => {
  it.each([
    ["1,250.50", 125050],
    ["Rs. 1,250", 125000],
    ["PKR 99.5", 9950],
    [1480, 148000],
    [12.5, 1250],
    ["0", 0],
  ] as const)("%s → %s", (input, expected) => {
    expect(parseInvoiceAmount(input)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "-50", "1.234", Number.NaN])("rejects %s", (input) => {
    expect(parseInvoiceAmount(input as string | number | null | undefined)).toBeNull();
  });
});

describe("normalizeExtraction", () => {
  it("keeps a clean invoice without issues, in integer minor units", () => {
    const x = normalizeExtraction(clean(), TODAY);
    expect(x.issues).toEqual([]);
    expect(x.total).toBe(1780000);
    expect(x.lines[0]).toEqual({
      description: "Cooking oil 5L",
      quantity: 10,
      unit: "pcs",
      unitPrice: 148000,
      lineTotal: 1480000,
    });
  });

  it("flags missing supplier, date and total instead of guessing", () => {
    const x = normalizeExtraction(clean({ supplierName: null, invoiceDate: "", total: null }), TODAY);
    const fields = x.issues.map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["supplier", "date", "total"]));
    expect(x.supplierName).toBeNull();
    expect(x.invoiceDate).toBeNull();
  });

  it("rejects an impossible date and flags a future one", () => {
    expect(normalizeExtraction(clean({ invoiceDate: "2026-02-30" }), TODAY).invoiceDate).toBeNull();
    const future = normalizeExtraction(clean({ invoiceDate: "2026-12-01" }), TODAY);
    expect(future.invoiceDate).toBe("2026-12-01");
    expect(future.issues.some((i) => i.message.includes("future"))).toBe(true);
  });

  it("flags a line whose quantity × unit price does not match its printed total", () => {
    const x = normalizeExtraction(
      clean({
        lines: [{ description: "Rice", quantity: 3, unit: "kg", unitPrice: "200", lineTotal: "900" }],
        subtotal: "900",
        total: "900",
      }),
      TODAY,
    );
    expect(x.issues.map((i) => i.message).join(" ")).toMatch(/Line 1: quantity × unit price/);
  });

  it("allows one rupee of rounding on line totals", () => {
    const x = normalizeExtraction(
      clean({
        lines: [{ description: "Tea", quantity: 3, unit: "pcs", unitPrice: "33.33", lineTotal: "100" }],
        subtotal: "100",
        total: "100",
      }),
      TODAY,
    );
    expect(x.issues).toEqual([]);
  });

  it("flags lines that do not add up to the subtotal, and subtotal + tax ≠ total", () => {
    const x = normalizeExtraction(clean({ subtotal: "20000", tax: "500", total: "20000" }), TODAY);
    const text = x.issues.map((i) => i.message).join(" ");
    expect(text).toMatch(/line totals do not add up/);
    expect(text).toMatch(/Subtotal plus tax/);
  });

  it("flags a fractional quantity, which purchases cannot record", () => {
    const x = normalizeExtraction(
      clean({
        lines: [{ description: "Flour", quantity: 2.5, unit: "kg", unitPrice: "100", lineTotal: "250" }],
        subtotal: "250",
        total: "250",
      }),
      TODAY,
    );
    expect(x.lines[0].quantity).toBe(2.5);
    expect(x.issues.some((i) => i.message.includes("not a whole number"))).toBe(true);
  });

  it("flags a document that is not an invoice and one with no lines", () => {
    const x = normalizeExtraction({ isInvoice: false, lines: [] }, TODAY);
    const fields = x.issues.map((i) => i.field);
    expect(x.isInvoice).toBe(false);
    expect(fields).toEqual(expect.arrayContaining(["document", "lines"]));
  });

  it("passes through what the model said it could not read", () => {
    const x = normalizeExtraction(clean({ unclear: ["Line 3 price is smudged"] }), TODAY);
    expect(x.issues).toEqual([{ field: "unclear", message: "The AI could not read clearly: Line 3 price is smudged" }]);
  });

  it("keeps at most 50 lines and says so", () => {
    const lines = Array.from({ length: 55 }, (_, i) => ({
      description: `Item ${i}`,
      quantity: 1,
      unit: "pcs",
      unitPrice: "10",
      lineTotal: "10",
    }));
    const x = normalizeExtraction(clean({ lines, subtotal: null, total: "550" }), TODAY);
    expect(x.lines).toHaveLength(50);
    expect(x.issues.some((i) => i.message.includes("first 50 lines"))).toBe(true);
  });
});

describe("suggestMatch", () => {
  const products = [
    { id: "a", name: "Cooking Oil 5L" },
    { id: "b", name: "Sugar" },
    { id: "c", name: "Brown Sugar" },
  ];

  it("matches exact names ignoring case and punctuation", () => {
    expect(suggestMatch("cooking oil - 5l", products)?.id).toBe("a");
  });

  it("matches one name containing the other only when it is unambiguous", () => {
    expect(suggestMatch("Dalda Cooking Oil 5L tin", products)?.id).toBe("a");
    expect(suggestMatch("sugar 1kg bag", products)?.id).toBe("b");
    // "Sugar" is part of two saved names: no guess.
    expect(suggestMatch("Sugar", [{ id: "x", name: "Sugar 1kg" }, { id: "y", name: "Sugar 5kg" }])).toBeNull();
  });

  it("returns null for an empty or unknown name", () => {
    expect(suggestMatch("", products)).toBeNull();
    expect(suggestMatch("Washing powder", products)).toBeNull();
  });
});
