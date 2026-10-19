import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCookieJar,
  createFakeAdminAuth,
  createFakeDb,
} from "./helpers/fakes";

const fakeAuth = createFakeAdminAuth();
const fakeDb = createFakeDb();
const jar = createCookieJar();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => fakeAuth,
  getAdminDb: () => fakeDb,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.session !== undefined ? { name, value: jar.session } : undefined,
  }),
}));

// getSessionUser() calls connection() (next/server), which needs a Next
// request scope. Tests invoke handlers directly, so stub it to a no-op;
// NextResponse and friends stay real.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: async () => {} };
});

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const ctx = <P extends Record<string, string>>(params: P) => ({
  params: Promise.resolve(params),
});

const SALE_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = undefined;
  fakeDb.seed("businesses/biz-a", { ownerId: "alice", name: "A Store" });
  fakeDb.seed("businesses/biz-b", { ownerId: "bob", name: "B Store" });
  fakeDb.seed("products/prod-a1", {
    businessId: "biz-a",
    name: "Flour 10kg",
    quantity: 10,
    unitCost: 90000,
    sellingPrice: 110000,
    reorderLevel: 3,
  });
  fakeDb.seed("products/prod-b1", {
    businessId: "biz-b",
    name: "Bob's Rice",
    quantity: 50,
    unitCost: 200000,
    sellingPrice: 250000,
  });
});

describe("products API", () => {
  it("requires sign-in (401 without a session)", async () => {
    const { GET } = await import(
      "@/app/api/businesses/[businessId]/products/route"
    );
    const response = await GET(request("GET", "/x"), ctx({ businessId: "biz-a" }));
    expect(response.status).toBe(401);
  });

  it("creates a product under the URL business — a body businessId is ignored", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/products/route"
    );
    const response = await POST(
      request("POST", "/x", {
        name: "Sugar 5kg",
        businessId: "biz-b", // injection attempt: must never be honored
        quantity: 20,
        unitCost: "600.00",
        sellingPrice: "750.50",
        reorderLevel: 4,
      }),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      product: { businessId: string; unitCost: number; sellingPrice: number };
    };
    expect(body.product.businessId).toBe("biz-a");
    expect(body.product.unitCost).toBe(60000); // parsed to minor units
    expect(body.product.sellingPrice).toBe(75050);
  });

  it("rejects invalid money with 400", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/products/route"
    );
    const response = await POST(
      request("POST", "/x", {
        name: "Bad",
        quantity: 1,
        unitCost: "-5",
        sellingPrice: "10",
      }),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(400);
  });

  it("denies cross-account access with 404 (isolation)", async () => {
    jar.session = "session-alice";
    const { GET } = await import(
      "@/app/api/businesses/[businessId]/products/route"
    );
    const response = await GET(request("GET", "/x"), ctx({ businessId: "biz-b" }));
    expect(response.status).toBe(404);
  });

  it("PATCH as another account is 404 and does not modify the product", async () => {
    jar.session = "session-alice";
    const { PATCH } = await import(
      "@/app/api/businesses/[businessId]/products/[productId]/route"
    );
    const response = await PATCH(
      request("PATCH", "/x", { sellingPrice: "1.00" }),
      ctx({ businessId: "biz-b", productId: "prod-b1" }),
    );
    expect(response.status).toBe(404);
    expect(fakeDb.read("products/prod-b1")).toMatchObject({
      sellingPrice: 250000,
    });
  });
});

describe("sales API", () => {
  function saleBody(overrides: Record<string, unknown> = {}) {
    return {
      saleId: SALE_ID,
      date: "2025-02-01",
      items: [{ productId: "prod-a1", quantity: 2 }],
      ...overrides,
    };
  }

  it("records a sale, calculates the total server-side and deducts stock", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const response = await POST(
      request("POST", "/x", saleBody()),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      created: boolean;
      sale: { total: number; items: { unitPrice: number; unitCost: number }[] };
    };
    expect(body.created).toBe(true);
    expect(body.sale.total).toBe(220000); // 2 × 1100.00, never client-supplied
    expect(body.sale.items[0].unitPrice).toBe(110000); // default selling price
    expect(body.sale.items[0].unitCost).toBe(90000); // cost basis snapshot
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 8 });
  });

  it("is idempotent: retrying the same saleId does not deduct stock twice", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const first = await POST(request("POST", "/x", saleBody()), ctx({ businessId: "biz-a" }));
    expect(first.status).toBe(201);
    const retry = await POST(request("POST", "/x", saleBody()), ctx({ businessId: "biz-a" }));
    expect(retry.status).toBe(200);
    const body = (await retry.json()) as { created: boolean };
    expect(body.created).toBe(false);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 8 });
  });

  it("rejects sales that would make stock negative (409)", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const response = await POST(
      request("POST", "/x", saleBody({ items: [{ productId: "prod-a1", quantity: 11 }] })),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(409);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 10 });
  });

  it("rejects items from another business (400) and changes nothing", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const response = await POST(
      request("POST", "/x", saleBody({ items: [{ productId: "prod-b1", quantity: 1 }] })),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(400);
    expect(fakeDb.read("products/prod-b1")).toMatchObject({ quantity: 50 });
  });

  it("rejects duplicate product rows (400)", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const response = await POST(
      request("POST", "/x", saleBody({
        items: [
          { productId: "prod-a1", quantity: 1 },
          { productId: "prod-a1", quantity: 2 },
        ],
      })),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(400);
  });

  it("denies recording a sale in another account's business (404)", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/sales/route"
    );
    const response = await POST(
      request("POST", "/x", saleBody({ items: [{ productId: "prod-b1", quantity: 1 }] })),
      ctx({ businessId: "biz-b" }),
    );
    expect(response.status).toBe(404);
    expect(fakeDb.read("products/prod-b1")).toMatchObject({ quantity: 50 });
  });
});

describe("expenses API", () => {
  it("creates and lists expenses for the owner only (isolation)", async () => {
    fakeDb.seed("expenses/exp-b1", {
      businessId: "biz-b",
      date: "2025-01-15",
      category: "Rent",
      amount: 5000000,
    });
    jar.session = "session-alice";
    const { POST, GET } = await import(
      "@/app/api/businesses/[businessId]/expenses/route"
    );
    const created = await POST(
      request("POST", "/x", {
        date: "2025-02-01",
        category: "Utilities",
        amount: "3500.00",
      }),
      ctx({ businessId: "biz-a" }),
    );
    expect(created.status).toBe(201);

    const list = await GET(request("GET", "/x"), ctx({ businessId: "biz-a" }));
    const body = (await list.json()) as {
      expenses: { businessId: string; category: string; amount: number }[];
    };
    expect(body.expenses).toHaveLength(1);
    expect(body.expenses[0]).toMatchObject({
      businessId: "biz-a",
      category: "Utilities",
      amount: 350000,
    });
  });

  it("rejects an impossible date with 400", async () => {
    jar.session = "session-alice";
    const { POST } = await import(
      "@/app/api/businesses/[businessId]/expenses/route"
    );
    const response = await POST(
      request("POST", "/x", { date: "2025-02-30", category: "Rent", amount: "10" }),
      ctx({ businessId: "biz-a" }),
    );
    expect(response.status).toBe(400);
  });

  it("owner can delete an expense; another account gets 404 and nothing changes", async () => {
    fakeDb.seed("expenses/exp-b1", {
      businessId: "biz-b",
      date: "2025-01-15",
      category: "Rent",
      amount: 5000000,
    });
    const { DELETE } = await import(
      "@/app/api/businesses/[businessId]/expenses/[expenseId]/route"
    );

    jar.session = "session-alice";
    const denied = await DELETE(
      request("DELETE", "/x"),
      ctx({ businessId: "biz-b", expenseId: "exp-b1" }),
    );
    expect(denied.status).toBe(404);
    expect(fakeDb.read("expenses/exp-b1")).toBeDefined();

    jar.session = "session-bob";
    const allowed = await DELETE(
      request("DELETE", "/x"),
      ctx({ businessId: "biz-b", expenseId: "exp-b1" }),
    );
    expect(allowed.status).toBe(204);
    expect(fakeDb.read("expenses/exp-b1")).toBeUndefined();
  });
});
