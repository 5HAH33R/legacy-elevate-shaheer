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

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

type BusinessJson = {
  business: {
    businessId: string;
    ownerId: string;
    name: string;
    currency: string;
  };
};

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = undefined;
});

describe("POST /api/businesses (onboarding)", () => {
  it("requires sign-in (401 without a session)", async () => {
    const { POST } = await import("@/app/api/businesses/route");
    const response = await POST(request("POST", "/api/businesses", { name: "X" }));
    expect(response.status).toBe(401);
  });

  it("creates a business owned by the session user — a body ownerId is ignored", async () => {
    jar.session = "session-alice";
    const { POST } = await import("@/app/api/businesses/route");
    const response = await POST(
      request("POST", "/api/businesses", {
        name: "A Kiryana Store",
        ownerId: "bob", // injection attempt: must never be honored
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as BusinessJson;
    expect(body.business.ownerId).toBe("alice");
    expect(body.business.currency).toBe("PKR"); // default (SPEC.md 9.2)
  });

  it("validates input with Zod (400 on empty name)", async () => {
    jar.session = "session-alice";
    const { POST } = await import("@/app/api/businesses/route");
    const response = await POST(request("POST", "/api/businesses", { name: "" }));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/businesses", () => {
  it("lists only the signed-in owner's businesses", async () => {
    fakeDb.seed("businesses/biz-a", { ownerId: "alice", name: "A Store" });
    fakeDb.seed("businesses/biz-b", { ownerId: "bob", name: "B Store" });
    jar.session = "session-alice";
    const { GET } = await import("@/app/api/businesses/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      businesses: { name: string }[];
    };
    expect(body.businesses.map((b) => b.name)).toEqual(["A Store"]);
  });
});

describe("cross-account isolation via businessId", () => {
  beforeEach(() => {
    fakeDb.seed("businesses/biz-b", {
      ownerId: "bob",
      name: "B Store",
      currency: "PKR",
    });
  });

  it("GET as another account is 404", async () => {
    jar.session = "session-alice";
    const { GET } = await import("@/app/api/businesses/[businessId]/route");
    const response = await GET(request("GET", "/api/businesses/biz-b"), {
      params: Promise.resolve({ businessId: "biz-b" }),
    });
    expect(response.status).toBe(404);
  });

  it("PATCH as another account is 404 and does not modify the record", async () => {
    jar.session = "session-alice";
    const { PATCH } = await import("@/app/api/businesses/[businessId]/route");
    const response = await PATCH(
      request("PATCH", "/api/businesses/biz-b", { name: "Hacked" }),
      { params: Promise.resolve({ businessId: "biz-b" }) },
    );
    expect(response.status).toBe(404);
    expect(fakeDb.read("businesses/biz-b")).toMatchObject({ name: "B Store" });
  });

  it("PATCH as the owner updates the record", async () => {
    jar.session = "session-bob";
    const { PATCH } = await import("@/app/api/businesses/[businessId]/route");
    const response = await PATCH(
      request("PATCH", "/api/businesses/biz-b", { name: "B General Store" }),
      { params: Promise.resolve({ businessId: "biz-b" }) },
    );
    expect(response.status).toBe(200);
    expect(fakeDb.read("businesses/biz-b")).toMatchObject({
      name: "B General Store",
      ownerId: "bob",
    });
  });
});
