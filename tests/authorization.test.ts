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

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = undefined;
});

describe("requireUser", () => {
  it("responds 401 when there is no session cookie", async () => {
    const { requireUser } = await import("@/server/auth");
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("responds 401 when the session cookie is invalid", async () => {
    jar.session = "not-a-real-cookie";
    const { requireUser } = await import("@/server/auth");
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("responds 401 after the session has been revoked", async () => {
    jar.session = "session-alice";
    fakeAuth.state.revoked.push("alice");
    const { requireUser } = await import("@/server/auth");
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("returns the verified user for a valid session", async () => {
    jar.session = "session-alice";
    const { requireUser } = await import("@/server/auth");
    const user = await requireUser();
    expect(user.uid).toBe("alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.platformAdmin).toBe(false);
  });
});

describe("requireBusinessOwner", () => {
  it("allows the owner", async () => {
    fakeDb.seed("businesses/biz-1", {
      ownerId: "alice",
      name: "A Store",
      currency: "PKR",
    });
    const { requireBusinessOwner } = await import("@/server/businesses");
    const business = await requireBusinessOwner("alice", "biz-1");
    expect(business.businessId).toBe("biz-1");
    expect(business.name).toBe("A Store");
  });

  it("denies a different account with 404 (cross-account isolation)", async () => {
    fakeDb.seed("businesses/biz-b", {
      ownerId: "bob",
      name: "B Store",
      currency: "PKR",
    });
    const { requireBusinessOwner } = await import("@/server/businesses");
    await expect(requireBusinessOwner("alice", "biz-b")).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it("responds 404 for a business that does not exist", async () => {
    const { requireBusinessOwner } = await import("@/server/businesses");
    await expect(requireBusinessOwner("alice", "missing")).rejects.toMatchObject(
      { status: 404 },
    );
  });
});
