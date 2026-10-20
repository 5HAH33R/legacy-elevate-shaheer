import { beforeEach, describe, expect, it, vi } from "vitest";
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
    get: (name: string) =>
      jar.session !== undefined ? { name, value: jar.session } : undefined,
  }),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: async () => {} };
});

const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const ctx = <P extends Record<string, string>>(p: P) => ({ params: Promise.resolve(p) });
const PID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

const PURCHASES = "@/app/api/businesses/[businessId]/purchases/route";
const VOID = "@/app/api/businesses/[businessId]/purchases/[purchaseId]/void/route";
const SUPPLIERS = "@/app/api/businesses/[businessId]/suppliers/route";
const SUPPLIER = "@/app/api/businesses/[businessId]/suppliers/[supplierId]/route";

function body(over: Record<string, unknown> = {}) {
  return {
    purchaseId: PID,
    supplierId: "sup-a",
    date: "2025-03-01",
    items: [{ productId: "prod-a1", quantity: 5, unit: "bag", unitCost: "950.00" }],
    ...over,
  };
}

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = "session-alice";
  fakeDb.seed("businesses/biz-a", { ownerId: "alice", name: "A" });
  fakeDb.seed("businesses/biz-b", { ownerId: "bob", name: "B" });
  fakeDb.seed("suppliers/sup-a", { businessId: "biz-a", name: "Acme", archivedAt: null });
  fakeDb.seed("suppliers/sup-b", { businessId: "biz-b", name: "Other", archivedAt: null });
  fakeDb.seed("products/prod-a1", { businessId: "biz-a", name: "Flour", quantity: 10, unitCost: 90000, sellingPrice: 110000 });
  fakeDb.seed("products/prod-b1", { businessId: "biz-b", name: "Rice", quantity: 50, unitCost: 1, sellingPrice: 2 });
});

describe("purchases", () => {
  it("ignores client total, increases stock, writes purchase movements, updates unitCost", async () => {
    const { POST } = await import(PURCHASES);
    const res = await POST(req("POST", body({ total: 1 })), ctx({ businessId: "biz-a" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.purchase.total).toBe(475000);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 15, unitCost: 95000 });
    const { listMovementsForProduct } = await import("@/server/inventory");
    const m = await listMovementsForProduct("biz-a", "prod-a1");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ type: "purchase", quantityDelta: 5, sourceRef: PID });
  });

  it("replay creates nothing extra", async () => {
    const { POST } = await import(PURCHASES);
    await POST(req("POST", body()), ctx({ businessId: "biz-a" }));
    const again = await POST(req("POST", body()), ctx({ businessId: "biz-a" }));
    expect(again.status).toBe(200);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 15 });
  });

  it("rejects other-business product or supplier", async () => {
    const { POST } = await import(PURCHASES);
    const p = await POST(
      req("POST", body({ items: [{ productId: "prod-b1", quantity: 1, unitCost: "1" }] })),
      ctx({ businessId: "biz-a" }),
    );
    expect(p.status).toBe(400);
    const s = await POST(req("POST", body({ supplierId: "sup-b" })), ctx({ businessId: "biz-a" }));
    expect(s.status).toBe(400);
    expect(fakeDb.read("products/prod-b1")).toMatchObject({ quantity: 50 });
    expect(fakeDb.read(`purchases/${PID}`)).toBeUndefined();
  });

  it("void is rejected when stock would go negative, and reverses otherwise", async () => {
    const { POST } = await import(PURCHASES);
    const { POST: voidPost } = await import(VOID);
    await POST(req("POST", body()), ctx({ businessId: "biz-a" }));
    fakeDb.seed("products/prod-a1", { ...fakeDb.read("products/prod-a1")!, quantity: 2 });
    const bad = await voidPost(req("POST"), ctx({ businessId: "biz-a", purchaseId: PID }));
    expect(bad.status).toBe(409);
    expect(fakeDb.read(`purchases/${PID}`)?.voidedAt).toBeNull();
    fakeDb.seed("products/prod-a1", { ...fakeDb.read("products/prod-a1")!, quantity: 15 });
    const ok = await voidPost(req("POST"), ctx({ businessId: "biz-a", purchaseId: PID }));
    expect(ok.status).toBe(204);
    expect(fakeDb.read("products/prod-a1")).toMatchObject({ quantity: 10 });
    expect(fakeDb.read(`purchases/${PID}`)?.voidedBy).toBe("alice");
  });

  it("isolates suppliers and purchases between owners", async () => {
    const { POST } = await import(PURCHASES);
    await POST(req("POST", body()), ctx({ businessId: "biz-a" }));
    jar.session = "session-bob";
    const { GET, POST: post } = await import(PURCHASES);
    const { POST: voidPost } = await import(VOID);
    const { GET: listSup } = await import(SUPPLIERS);
    const { GET: getSup } = await import(SUPPLIER);
    const c = ctx({ businessId: "biz-a" });
    expect((await GET(req("GET"), c)).status).toBe(404);
    expect((await post(req("POST", body()), c)).status).toBe(404);
    expect((await listSup(req("GET"), c)).status).toBe(404);
    expect((await getSup(req("GET"), ctx({ businessId: "biz-a", supplierId: "sup-a" }))).status).toBe(404);
    expect((await voidPost(req("POST"), ctx({ businessId: "biz-a", purchaseId: PID }))).status).toBe(404);
    // Bob's own business cannot void Alice's purchase either.
    expect((await voidPost(req("POST"), ctx({ businessId: "biz-b", purchaseId: PID }))).status).toBe(404);
    expect(fakeDb.read(`purchases/${PID}`)?.voidedAt).toBeNull();
  });
});
