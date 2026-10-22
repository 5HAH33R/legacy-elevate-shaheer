import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, createFakeAdminAuth, createFakeDb } from "./helpers/fakes";

const fakeAuth = createFakeAdminAuth();
const fakeDb = createFakeDb();
const jar = createCookieJar();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => fakeAuth,
  getAdminDb: () => fakeDb,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.session !== undefined ? { name, value: jar.session } : undefined),
  }),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: async () => {} };
});

const UPLOAD = "@/app/api/businesses/[businessId]/invoices/route";
const ONE = "@/app/api/businesses/[businessId]/invoices/[invoiceId]/route";
const CONFIRM = "@/app/api/businesses/[businessId]/invoices/[invoiceId]/confirm/route";
const PID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const PID2 = "9b2f1c3e-1d2a-4b5c-8d9e-0f1a2b3c4d5e";
const API_KEY = "test-secret-key-123";

const ctx = <P extends Record<string, string>>(p: P) => ({ params: Promise.resolve(p) });
const json = (method: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

/** A tiny but real PNG header followed by filler bytes. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);

function upload(bytes: Uint8Array, type = "image/png", name = "bill.png") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return new Request("http://localhost/x", { method: "POST", body: form });
}

const EXTRACTED = {
  isInvoice: true,
  supplierName: "Acme Wholesale",
  invoiceNumber: "INV-7",
  invoiceDate: "2025-03-01",
  currency: "PKR",
  lines: [
    { description: "Flour", quantity: 5, unit: "bag", unitPrice: "950", lineTotal: "4750" },
    { description: "Mystery item", quantity: 1, unit: "pcs", unitPrice: "100", lineTotal: "100" },
  ],
  subtotal: "4850",
  tax: "0",
  total: "4850",
  unclear: [],
};

const providerCalls: { body: { contents: { parts: Record<string, unknown>[] }[] } }[] = [];
let providerReply: () => Response;

function geminiJson(payload: unknown) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: "STOP" }] }),
    { status: 200 },
  );
}

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = "session-alice";
  providerCalls.length = 0;
  providerReply = () => geminiJson(EXTRACTED);
  vi.stubEnv("AI_API_KEY", API_KEY);
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_INVOICE_DAILY_LIMIT", "");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    providerCalls.push({ body: JSON.parse(String(init.body)) });
    return providerReply();
  });
  fakeDb.seed("businesses/biz-a", { ownerId: "alice", name: "A" });
  fakeDb.seed("businesses/biz-b", { ownerId: "bob", name: "B" });
  fakeDb.seed("suppliers/sup-a", { businessId: "biz-a", name: "Acme Wholesale", archivedAt: null });
  fakeDb.seed("products/prod-a1", { businessId: "biz-a", name: "Flour", quantity: 10, unitCost: 90000, sellingPrice: 110000 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function scan(businessId = "biz-a", request = upload(PNG)) {
  const { POST } = await import(UPLOAD);
  return POST(request, ctx({ businessId }));
}

async function scanned(): Promise<string> {
  const res = await scan();
  expect(res.status).toBe(201);
  return (await res.json()).invoice.invoiceId;
}

function confirmBody(over: Record<string, unknown> = {}) {
  return {
    purchaseId: PID,
    supplierId: "sup-a",
    date: "2025-03-01",
    items: [{ productId: "prod-a1", quantity: 5, unit: "bag", unitCost: "950.00" }],
    ...over,
  };
}

describe("invoice upload", () => {
  it("requires sign-in and never calls the AI", async () => {
    jar.session = undefined;
    expect((await scan()).status).toBe(401);
    expect(providerCalls).toHaveLength(0);
  });

  it("returns 404 for another owner's business and never calls the AI", async () => {
    jar.session = "session-bob";
    expect((await scan("biz-a")).status).toBe(404);
    expect(providerCalls).toHaveLength(0);
  });

  it("checks the real file type, not just the label", async () => {
    const fake = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3]); // an .exe renamed
    const res = await scan("biz-a", upload(fake, "image/png", "bill.png"));
    expect(res.status).toBe(415);
    expect(providerCalls).toHaveLength(0);
  });

  it("rejects files over the size limit", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(PNG.subarray(0, 8));
    expect((await scan("biz-a", upload(big))).status).toBe(413);
    expect(providerCalls).toHaveLength(0);
  });

  it("says 'not configured' without an AI key, with no fake result", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const res = await scan();
    expect(res.status).toBe(503);
    expect(fakeDb.read("invoices/auto-1")).toBeUndefined();
  });

  it("sends the file inline, saves the reading for review and records nothing yet", async () => {
    const res = await scan();
    expect(res.status).toBe(201);
    const { invoice } = await res.json();
    const parts = providerCalls[0].body.contents[0].parts;
    expect(parts[0]).toMatchObject({ inlineData: { mimeType: "image/png" } });
    expect(invoice).toMatchObject({
      reviewStatus: "needs_review",
      filePath: null,
      invoiceDate: "2025-03-01",
      extractedData: { supplierName: "Acme Wholesale", total: 485000 },
    });
    expect(invoice.extractedData.lines[0]).toMatchObject({ unitPrice: 95000, quantity: 5 });
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 10, unitCost: 90000 });
    const { listPurchasesForBusiness } = await import("@/server/purchases");
    expect(await listPurchasesForBusiness("biz-a")).toHaveLength(0);
  });

  it("rejects an unreadable AI answer instead of saving it", async () => {
    providerReply = () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), { status: 200 });
    expect((await scan()).status).toBe(502);
  });

  it("enforces the daily invoice-scan limit", async () => {
    vi.stubEnv("AI_INVOICE_DAILY_LIMIT", "1");
    expect((await scan()).status).toBe(201);
    const second = await scan();
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/invoice scans/);
    expect(providerCalls).toHaveLength(1);
  });
});

describe("invoice review and confirm", () => {
  it("confirming records one purchase linked to the invoice and adds stock", async () => {
    const invoiceId = await scanned();
    const { POST } = await import(CONFIRM);
    const res = await POST(json("POST", confirmBody()), ctx({ businessId: "biz-a", invoiceId }));
    expect(res.status).toBe(200);
    const { invoice, purchase } = await res.json();
    expect(purchase).toMatchObject({ purchaseId: PID, total: 475000, sourceDocumentId: invoiceId, supplierId: "sup-a" });
    expect(invoice).toMatchObject({ reviewStatus: "confirmed", purchaseId: PID });
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 15, unitCost: 95000 });
  });

  it("a retry with the same purchaseId adds stock only once", async () => {
    const invoiceId = await scanned();
    const { POST } = await import(CONFIRM);
    await POST(json("POST", confirmBody()), ctx({ businessId: "biz-a", invoiceId }));
    const again = await POST(json("POST", confirmBody()), ctx({ businessId: "biz-a", invoiceId }));
    expect(again.status).toBe(200);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 15 });
    const other = await POST(json("POST", confirmBody({ purchaseId: PID2 })), ctx({ businessId: "biz-a", invoiceId }));
    expect(other.status).toBe(409);
  });

  it("creates a new supplier only once, even when the confirm is retried", async () => {
    const invoiceId = await scanned();
    fakeDb.seed("products/prod-a1", { businessId: "biz-a", name: "Flour", quantity: 1, unitCost: 90000, sellingPrice: 110000 });
    const { POST } = await import(CONFIRM);
    const body = confirmBody({ supplierId: undefined, newSupplierName: "Naya Supplier" });
    const first = await (await POST(json("POST", body), ctx({ businessId: "biz-a", invoiceId }))).json();
    await POST(json("POST", body), ctx({ businessId: "biz-a", invoiceId }));
    const { listSuppliersForBusiness } = await import("@/server/suppliers");
    const names = (await listSuppliersForBusiness("biz-a")).map((s) => s.name);
    expect(names.filter((n) => n === "Naya Supplier")).toHaveLength(1);
    expect(first.purchase.supplierName).toBe("Naya Supplier");
  });

  it("rejects products from another business and leaves the invoice in review", async () => {
    fakeDb.seed("products/prod-b1", { businessId: "biz-b", name: "Rice", quantity: 50, unitCost: 1, sellingPrice: 2 });
    const invoiceId = await scanned();
    const { POST } = await import(CONFIRM);
    const res = await POST(
      json("POST", confirmBody({ items: [{ productId: "prod-b1", quantity: 1, unit: "pcs", unitCost: "1" }] })),
      ctx({ businessId: "biz-a", invoiceId }),
    );
    expect(res.status).toBe(400);
    expect(fakeDb.read(`invoices/${invoiceId}`)).toMatchObject({ reviewStatus: "needs_review" });
    expect(fakeDb.read("products/prod-b1")).toMatchObject({ quantity: 50 });
  });

  it("validates the reviewed lines (whole quantities, supplier choice)", async () => {
    const invoiceId = await scanned();
    const { POST } = await import(CONFIRM);
    const bad = await POST(
      json("POST", confirmBody({ items: [{ productId: "prod-a1", quantity: 2.5, unit: "kg", unitCost: "1" }] })),
      ctx({ businessId: "biz-a", invoiceId }),
    );
    expect(bad.status).toBe(400);
    const both = await POST(json("POST", confirmBody({ newSupplierName: "X" })), ctx({ businessId: "biz-a", invoiceId }));
    expect(both.status).toBe(400);
  });

  it("discarding records nothing and blocks a later confirm", async () => {
    const invoiceId = await scanned();
    const { DELETE } = await import(ONE);
    const res = await DELETE(json("DELETE"), ctx({ businessId: "biz-a", invoiceId }));
    expect((await res.json()).invoice.reviewStatus).toBe("discarded");
    const { POST } = await import(CONFIRM);
    expect((await POST(json("POST", confirmBody()), ctx({ businessId: "biz-a", invoiceId }))).status).toBe(409);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 10 });
  });

  it("another owner cannot read, confirm or discard the invoice", async () => {
    const invoiceId = await scanned();
    jar.session = "session-bob";
    const { GET, DELETE } = await import(ONE);
    const { POST } = await import(CONFIRM);
    expect((await GET(json("GET"), ctx({ businessId: "biz-a", invoiceId }))).status).toBe(404);
    expect((await GET(json("GET"), ctx({ businessId: "biz-b", invoiceId }))).status).toBe(404);
    expect((await POST(json("POST", confirmBody()), ctx({ businessId: "biz-b", invoiceId }))).status).toBe(404);
    expect((await DELETE(json("DELETE"), ctx({ businessId: "biz-b", invoiceId }))).status).toBe(404);
    expect(fakeDb.read(`invoices/${invoiceId}`)).toMatchObject({ reviewStatus: "needs_review" });
  });
});

describe("invoice types (phase 1)", () => {
  it("defaults to a purchase and uses the supplier prompt", async () => {
    const res = await scan();
    const { invoice } = await res.json();
    expect(invoice.invoiceType).toBe("purchase");
    const system = (providerCalls[0].body as unknown as { systemInstruction: { parts: { text: string }[] } })
      .systemInstruction.parts[0].text;
    expect(system).toMatch(/BUYER/);
    expect(invoice.extractedData.lines[0]).toMatchObject({ matchedProductId: "prod-a1", arithmeticValid: true });
    expect(invoice.extractedData.lines[1]).toMatchObject({ matchedProductId: null, arithmeticValid: true });
  });

  it("scans a sale with the receipt prompt and keeps customer, payment and discount", async () => {
    providerReply = () =>
      geminiJson({
        isInvoice: true,
        customerName: "Ali",
        paymentMethod: "online",
        discountAmount: "10",
        invoiceDate: "2025-03-01",
        lines: [{ description: "Flour", quantity: 1, unitPrice: "1100", lineTotal: "1100" }],
        total: "1090",
        unclearFields: [],
      });
    const form = new FormData();
    form.append("file", new File([new Uint8Array(PNG)], "r.png", { type: "image/png" }));
    form.append("invoiceType", "sale");
    const res = await scan("biz-a", new Request("http://localhost/x", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const { invoice } = await res.json();
    const system = (providerCalls[0].body as unknown as { systemInstruction: { parts: { text: string }[] } })
      .systemInstruction.parts[0].text;
    expect(system).toMatch(/SELLER/);
    expect(invoice).toMatchObject({
      invoiceType: "sale",
      filePath: null,
      extractedData: { customerName: "Ali", paymentMethod: "online", discountAmount: 1000, supplierName: null },
    });
  });

  it("rejects an unknown invoice type before calling the AI", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(PNG)], "r.png", { type: "image/png" }));
    form.append("invoiceType", "refund");
    const res = await scan("biz-a", new Request("http://localhost/x", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect(providerCalls).toHaveLength(0);
  });

  it("treats a stored invoice with no invoiceType as a purchase", async () => {
    fakeDb.seed("invoices/legacy", {
      businessId: "biz-a",
      reviewStatus: "needs_review",
      extractedData: { lines: [{ description: "Flour", quantity: 1 }], issues: [] },
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const { getInvoiceForBusiness } = await import("@/server/invoices");
    const inv = await getInvoiceForBusiness("biz-a", "legacy");
    expect(inv.invoiceType).toBe("purchase");
    expect(inv.extractedData.lines[0]).toMatchObject({ matchedProductId: null, arithmeticValid: true });
  });
});
