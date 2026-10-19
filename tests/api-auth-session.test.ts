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

function sessionRequest(body: unknown) {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = undefined;
});

describe("POST /api/auth/session", () => {
  it("creates an httpOnly session cookie and the users/{uid} record", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(sessionRequest({ idToken: "id-token-alice" }));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__elevate_session=session-alice");
    expect(setCookie).toMatch(/httponly/i);
    expect(setCookie).toMatch(/samesite=lax/i);

    // users/{uid} created server-side on first sign-in (SPEC.md 9.1)
    expect(fakeDb.read("users/alice")).toMatchObject({
      uid: "alice",
      email: "alice@example.com",
      name: "User alice",
    });
  });

  it("rejects an unverifiable ID token with 401 and sets no cookie", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(sessionRequest({ idToken: "bogus" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fakeDb.read("users/bogus")).toBeUndefined();
  });

  it("rejects a malformed body with 400", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(sessionRequest({}));
    expect(response.status).toBe(400);
  });
});

describe("session restore and sign-out", () => {
  it("keeps the user signed in across requests (session restore)", async () => {
    jar.session = "session-alice";
    const { GET } = await import("@/app/api/businesses/route");
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("rejects requests after the cookie is gone (signed out)", async () => {
    const { GET } = await import("@/app/api/businesses/route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("sign-out clears the cookie and revokes tokens so old sessions die", async () => {
    jar.session = "session-alice";
    const { DELETE } = await import("@/app/api/auth/session/route");
    const response = await DELETE();
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__elevate_session=;");
    expect(fakeAuth.state.revoked).toContain("alice");

    // The old cookie must no longer verify anywhere.
    const { verifySessionUser } = await import("@/server/session");
    expect(await verifySessionUser("session-alice")).toBeNull();
  });
});
