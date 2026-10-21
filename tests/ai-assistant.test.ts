import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  createCookieJar,
  createFakeAdminAuth,
  createFakeDb,
} from "./helpers/fakes";
import { todayInTimeZone } from "@/lib/dates";
import { resolvePeriod } from "@/lib/periods";

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

const API_KEY = "test-secret-key-123";
const today = todayInTimeZone("Asia/Karachi");

/** Stand-in for the Gemini REST API; records each request body. */
type GeminiRequestBody = {
  systemInstruction: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
};
const providerCalls: { url: string; headers: Record<string, string>; body: GeminiRequestBody }[] = [];
let providerReply: () => Response;

function geminiText(text: string, finishReason = "STOP") {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text }] }, finishReason }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/x", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const ctx = <P extends Record<string, string>>(params: P) => ({
  params: Promise.resolve(params),
});

const BUSINESS_RECORD_KEYS = [
  "products/p-a",
  "products/p-b",
  "sales/s-a",
  "sales/s-b",
  "expenses/e-a",
  "expenses/e-b",
];

beforeEach(() => {
  fakeAuth.reset();
  fakeDb.reset();
  jar.session = undefined;
  providerCalls.length = 0;
  providerReply = () => geminiText("Is mahine aap ka gross profit PKR 800.00 hai.");
  vi.stubEnv("AI_API_KEY", API_KEY);
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_DAILY_LIMIT", "");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    providerCalls.push({
      url: String(url),
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    return providerReply();
  });

  fakeDb.seed("businesses/biz-a", { ownerId: "alice", name: "A Store", currency: "PKR" });
  fakeDb.seed("businesses/biz-b", { ownerId: "bob", name: "B Store", currency: "PKR" });
  fakeDb.seed("products/p-a", {
    businessId: "biz-a", name: "Flour 10kg", quantity: 2, reorderLevel: 5, unitCost: 600, sellingPrice: 1000,
  });
  fakeDb.seed("products/p-b", {
    businessId: "biz-b", name: "Secret Rice", quantity: 99, reorderLevel: 1, unitCost: 1, sellingPrice: 2,
  });
  fakeDb.seed("sales/s-a", {
    businessId: "biz-a", date: today, total: 200000,
    items: [{ productId: "p-a", name: "Flour 10kg", quantity: 2, unitPrice: 100000, unitCost: 60000 }],
  });
  fakeDb.seed("sales/s-b", {
    businessId: "biz-b", date: today, total: 777700,
    items: [{ productId: "p-b", name: "Secret Rice", quantity: 1, unitPrice: 777700, unitCost: 1 }],
  });
  fakeDb.seed("expenses/e-a", { businessId: "biz-a", date: today, category: "Rent", amount: 30000 });
  fakeDb.seed("expenses/e-b", { businessId: "biz-b", date: today, category: "Rent", amount: 999900 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function chatRoute() {
  return (await import("@/app/api/businesses/[businessId]/ai/chat/route")).POST;
}

async function ask(businessId: string, body: unknown) {
  const POST = await chatRoute();
  return POST(request("POST", body), ctx({ businessId }));
}

describe("POST /ai/chat — authorization", () => {
  it("requires sign-in (401) and never calls the AI provider", async () => {
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(401);
    expect(providerCalls).toHaveLength(0);
  });

  it("returns 404 for another owner's business and never calls the AI provider", async () => {
    jar.session = "session-bob";
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(404);
    expect(providerCalls).toHaveLength(0);
  });

  it("rejects empty and too-long questions (400)", async () => {
    jar.session = "session-alice";
    expect((await ask("biz-a", { question: "   " })).status).toBe(400);
    expect((await ask("biz-a", { question: "x".repeat(1001) })).status).toBe(400);
    expect((await ask("biz-a", {})).status).toBe(400);
    expect(providerCalls).toHaveLength(0);
  });
});

describe("POST /ai/chat — grounded answers", () => {
  it("sends only this business's figures, matching the dashboard calculations", async () => {
    jar.session = "session-alice";
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(200);
    expect(providerCalls).toHaveLength(1);

    const call = providerCalls[0];
    expect(call.url).toContain("gemini-3.5-flash-lite:generateContent");
    expect(call.headers["x-goog-api-key"]).toBe(API_KEY);
    const system = call.body.systemInstruction.parts[0].text;
    expect(system).toContain("Flour 10kg");
    expect(system).toContain("Roman Urdu");
    expect(system).not.toContain("Secret Rice");
    expect(system).not.toContain("alice");
    expect(call.body.contents).toEqual([{ role: "user", parts: [{ text: "Mera profit kitna hua?" }] }]);

    const { getDashboardReport } = await import("@/server/reports");
    const period = resolvePeriod({ period: "this-month" }, today).period;
    const report = await getDashboardReport("biz-a", period, today, fakeDb as unknown as Firestore);
    const { conversation } = await response.json();
    const answer = conversation.messages[1];
    expect(answer).toMatchObject({ role: "assistant", language: "roman-ur", model: "gemini-3.5-flash-lite" });
    expect(answer.text).toBe("Is mahine aap ka gross profit PKR 800.00 hai.");
    expect(answer.snapshot.periods[0]).toMatchObject({
      revenue: report.summary.revenue,
      grossProfit: report.summary.grossProfit,
      expenses: report.summary.expenses,
      estimatedNetProfit: report.summary.estimatedNetProfit,
    });
    expect(report.summary.revenue).toBe(200000);
  });

  it("does not modify any business record", async () => {
    jar.session = "session-alice";
    const before = BUSINESS_RECORD_KEYS.map((k) => JSON.stringify(fakeDb.read(k)));
    expect((await ask("biz-a", { question: "Increase my stock of flour to 100" })).status).toBe(200);
    expect(BUSINESS_RECORD_KEYS.map((k) => JSON.stringify(fakeDb.read(k)))).toEqual(before);
  });

  it("saves the conversation so it is still there after signing in again", async () => {
    jar.session = "session-alice";
    const first = await (await ask("biz-a", { question: "Mera profit kitna hua?" })).json();
    const conversationId = first.conversation.conversationId;

    providerReply = () => geminiText("Flour 10kg ka stock kam hai.");
    const second = await ask("biz-a", { question: "Aur stock?", conversationId });
    expect(second.status).toBe(200);
    // Follow-ups send the earlier exchange as history.
    expect(providerCalls[1].body.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);

    // Sign out and in again: a new session cookie, same user.
    jar.session = undefined;
    jar.session = "session-alice";
    const { GET: list } = await import("@/app/api/businesses/[businessId]/ai/conversations/route");
    const listed = await (await list(request("GET"), ctx({ businessId: "biz-a" }))).json();
    expect(listed.conversations).toHaveLength(1);
    expect(listed.conversations[0]).toMatchObject({ conversationId, messageCount: 4 });

    const { GET: getOne } = await import(
      "@/app/api/businesses/[businessId]/ai/conversations/[conversationId]/route"
    );
    const loaded = await (await getOne(request("GET"), ctx({ businessId: "biz-a", conversationId }))).json();
    expect(loaded.conversation.messages.map((m: { text: string }) => m.text)).toEqual([
      "Mera profit kitna hua?",
      "Is mahine aap ka gross profit PKR 800.00 hai.",
      "Aur stock?",
      "Flour 10kg ka stock kam hai.",
    ]);
  });

  it("another user cannot read, continue or delete the conversation (404)", async () => {
    jar.session = "session-alice";
    const { conversation } = await (await ask("biz-a", { question: "Mera profit kitna hua?" })).json();
    const conversationId = conversation.conversationId;

    jar.session = "session-bob";
    const { GET: getOne, DELETE } = await import(
      "@/app/api/businesses/[businessId]/ai/conversations/[conversationId]/route"
    );
    expect((await getOne(request("GET"), ctx({ businessId: "biz-a", conversationId }))).status).toBe(404);
    expect((await getOne(request("GET"), ctx({ businessId: "biz-b", conversationId }))).status).toBe(404);
    expect((await DELETE(request("DELETE"), ctx({ businessId: "biz-b", conversationId }))).status).toBe(404);
    expect((await ask("biz-b", { question: "hi", conversationId })).status).toBe(404);
    expect(fakeDb.read(`aiConversations/${conversationId}`)).toBeDefined();

    jar.session = "session-alice";
    expect((await DELETE(request("DELETE"), ctx({ businessId: "biz-a", conversationId }))).status).toBe(204);
    expect(fakeDb.read(`aiConversations/${conversationId}`)).toBeUndefined();
  });
});

describe("POST /ai/chat — failures", () => {
  it("reports 'not configured' without a fake answer when no API key is set", async () => {
    vi.stubEnv("AI_API_KEY", "");
    jar.session = "session-alice";
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not configured/);
    expect(providerCalls).toHaveLength(0);
  });

  it("retries a provider 5xx once, then fails safely without saving or leaking", async () => {
    providerReply = () => new Response(`{"error":"internal","key":"${API_KEY}"}`, { status: 500 });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    jar.session = "session-alice";
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(503);
    expect(providerCalls).toHaveLength(2);
    const text = await response.text();
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("Flour");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(API_KEY);
    const { listConversationsForOwner } = await import("@/server/ai/conversations");
    expect(await listConversationsForOwner("biz-a", "alice", fakeDb as unknown as Firestore)).toHaveLength(0);
    errorLog.mockRestore();
  });

  it("maps provider quota errors to 429 without retrying", async () => {
    providerReply = () => new Response("{}", { status: 429 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    jar.session = "session-alice";
    const response = await ask("biz-a", { question: "Mera profit kitna hua?" });
    expect(response.status).toBe(429);
    expect(providerCalls).toHaveLength(1);
  });

  it("rejects an empty or malformed provider answer instead of saving it", async () => {
    providerReply = () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    jar.session = "session-alice";
    expect((await ask("biz-a", { question: "Mera profit kitna hua?" })).status).toBe(502);
  });

  it("enforces the per-user daily question limit (429)", async () => {
    vi.stubEnv("AI_DAILY_LIMIT", "1");
    jar.session = "session-alice";
    expect((await ask("biz-a", { question: "Mera profit kitna hua?" })).status).toBe(200);
    const second = await ask("biz-a", { question: "Aur sales?" });
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/today's limit of 1/);
    expect(providerCalls).toHaveLength(1);
  });
});

describe("product cost provenance (Phase 5 fix)", () => {
  it("a manual unit-cost edit clears the purchase provenance", async () => {
    fakeDb.seed("products/p-a", {
      businessId: "biz-a", name: "Flour 10kg", quantity: 2, reorderLevel: 5, unitCost: 600, sellingPrice: 1000,
      costUpdatedFromPurchaseDate: "2025-03-01", costUpdatedFromPurchaseId: "pu-1",
    });
    jar.session = "session-alice";
    const { PATCH } = await import("@/app/api/businesses/[businessId]/products/[productId]/route");

    const renamed = await PATCH(request("PATCH", { name: "Flour 10 kg" }), ctx({ businessId: "biz-a", productId: "p-a" }));
    expect((await renamed.json()).product.costUpdatedFromPurchaseDate).toBe("2025-03-01");

    const response = await PATCH(request("PATCH", { unitCost: "7.50" }), ctx({ businessId: "biz-a", productId: "p-a" }));
    expect(response.status).toBe(200);
    const { product } = await response.json();
    expect(product).toMatchObject({ unitCost: 750, costUpdatedFromPurchaseDate: null, costUpdatedFromPurchaseId: null });
  });
});
