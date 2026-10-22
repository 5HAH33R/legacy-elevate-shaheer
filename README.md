# Elevate

AI-powered business management assistant for small business owners in Pakistan.

- Product specification: [SPEC.md](SPEC.md)
- Rules for contributors and AI agents: [AGENTS.md](AGENTS.md)

## Status

Phase 3 (business records: products, inventory, sales, expenses and a recorded-data dashboard) is done. Phase 2 added authentication and the secure workspace: owners sign up, sign in, reset their password and create a business workspace, with ownership enforced on the server for every protected page and API route. Phase 3 builds the first real records on top of it:

- **Products & inventory** (`/dashboard/[businessId]/products`): add and edit products with stock quantity, unit cost, selling price and an optional low-stock threshold. Low stock is flagged with text + icon (never color alone).
- **Sales** (`/dashboard/[businessId]/sales`): record multi-item sales against stock. Totals are calculated on the server from validated line items; stock is deducted in the same Firestore transaction; sales that would make stock negative are rejected (409); a client-generated `saleId` makes submission idempotent so a retry can never deduct stock twice.
- **Expenses** (`/dashboard/[businessId]/expenses`): record and delete dated, categorized expenses.
- **Summary** (`/dashboard/[businessId]`): recorded revenue, recorded expenses and gross profit (cost basis: unit costs snapshotted at sale time), plus low-stock alerts. Every figure is computed from the owner's own records — nothing is estimated or invented, and gross profit is never presented as net profit.

Phase 4 adds **suppliers** and **purchases** (`/dashboard/[businessId]/suppliers`, `/purchases`):

- Suppliers can be created, edited and archived (never hard-deleted).
- A purchase is idempotent on a client `purchaseId`, validates the supplier and products belong to the business, computes the total on the server, and increases stock through `applyStockMovements` (`purchase` movements) in one transaction.
- **Cost policy:** `products.unitCost` is set to the latest purchase unit cost (the product page shows "cost updated from purchase on <date>"). Voiding a purchase does not roll the cost back.
- **Void:** writes reversing movements (rejected with 409 if stock would go negative) and sets `voidedAt`/`voidedBy`. Nothing is deleted.
- Price history is listed on the product and supplier pages (data only, no comparison logic).
- Purchase lists filter by date and supplier in memory on a single-field `businessId` query, so no composite index is needed at MVP scale.

### Phase 5: reporting, pricing and supplier comparison

All figures are deterministic (pure functions in `src/lib/`, no AI), money is integer minor units, and dates are `YYYY-MM-DD` in the business time zone (default Asia/Karachi).

**Dashboard** (`/dashboard/[businessId]?period=…`): a plain GET form picks `this-month` (to date), `last-month`, `last-30-days` or `custom` (`from`/`to`, max 366 days). Invalid input shows the validation message and falls back to this month.

- Revenue = Σ sale totals in the period.
- COGS = revenue − gross profit; gross profit = Σ (unit price − unit cost) × qty using the unit cost **snapshotted on each sale line at sale time**.
- Gross margin = gross profit ÷ revenue (shown as "Not calculable" when revenue is 0).
- Recorded expenses = non-voided expenses in the period.
- **Estimated net profit (recorded expenses only)** = gross profit − recorded expenses. It is an estimate, not complete net profit; warnings are shown for no sales, no expenses, zero-cost items and voided purchases.
- Trend: daily buckets for ranges ≤ 31 days, else Monday-start weekly buckets; "not enough data" when fewer than 2 buckets have activity. Shown as a table (no chart library).
- **Restock estimate** (low-stock products only) = ceil(units sold in last 30 days ÷ 30 × 14) + reorder level − current stock, never below 0. Needs sales on at least 3 different days in the last 30, otherwise "insufficient sales history".

**Product page**: the pricing calculator is client-side what-if only (nothing saved): margin % = (price − cost) ÷ price, markup % = (price − cost) ÷ cost, "Not calculable" when the divisor is 0. Cost basis is the product's unit cost, labelled "updated from purchase on <date>" or "entered manually".

**Supplier price comparison** uses only your own non-voided purchases (never market prices). Prices are compared per unit (case-insensitive: `pcs` = `PCS`; `kg` separate). Latest price per supplier, min/max/mean/median are shown with supplier and date. Outlier: more than 50% away from the group median, checked only with ≥ 3 purchases. A group is flagged "limited data" with one supplier or < 3 purchases, and "stale" when its newest price is over 180 days old.

Tests: `src/lib/{periods,pricing,reports,restock,supplier-comparison}.test.ts` and `tests/reports.test.ts` (cross-business isolation).

### Phase 6: grounded AI business assistant

**Assistant** (`/dashboard/[businessId]/assistant`): the owner asks questions in English, Urdu or Roman Urdu ("Mera profit kitna hua?") and gets an answer from a real hosted model (Google Gemini, `gemini-3.5-flash-lite` by default) grounded in their own records.

- **Request flow** (SPEC 8.1): `POST /api/businesses/[businessId]/ai/chat` runs `requireUser()` → `requireBusinessOwner()` before reading any data or calling the model. Another owner's business or conversation → 404 and the model is never called.
- **Grounding**: `src/server/ai/context.ts` loads the business's records once and builds this month's and last month's summary with the **same functions as the dashboard** (`buildDashboardReport`), plus top products, low-stock/restock estimates and up to 40 products (name, stock, selling price, alert level). Money is pre-formatted, so the model only quotes numbers and never calculates them. Data warnings (no expenses, zero-cost items…) are passed through.
- **What is sent to the AI service**: business name/type, currency, today's date, those figures and product names. Never owner id, email, supplier details, purchase lines, document ids or other businesses' data.
- **System prompt** (`src/server/ai/prompt.ts`): quote figures exactly, say when data is missing, label facts vs estimates vs suggestions, no guarantees or professional advice, never claim to change records, answer in the question's language (detected by `src/lib/language.ts`).
- **Read-only**: the assistant writes only `aiConversations` and `aiUsage`; it cannot change products, sales, expenses or purchases.
- **Saved answers**: every question + answer is saved in `aiConversations` (top-level, `businessId` + `ownerId`, messages array capped at 40) with a snapshot of the figures used, so it is still there after signing out and in again. Owners can open and delete their conversations. Only the owner can read them.
- **Limits and failures**: `AI_DAILY_LIMIT` questions per user per day (default 30, counted in `aiUsage/{uid}_{date}`) protects the free quota → 429. No `AI_API_KEY` → "not configured" (503), never a fake answer. Provider 5xx/network errors are retried once; quota → 429; blocked → 422; empty/malformed → 502. Error messages and logs never contain the key, prompt or business data.

Set up: create a free key at [Google AI Studio](https://aistudio.google.com/apikey) and put it in `.env.local` as `AI_API_KEY` (see `.env.example`). On the free tier Google may use requests to improve its products; see [AI_DISCLOSURE.md](AI_DISCLOSURE.md).

Tests: `tests/ai-assistant.test.ts` (auth, cross-business isolation, figures match the dashboard, saved conversations, no record writes, failures, rate limit) and `src/lib/language.test.ts`. The AI provider is stubbed in tests; no network calls.

### Phase 7: smart invoice analysis

**Invoices** (`/dashboard/[businessId]/invoices`, "Scan invoices" in the sidebar): the owner uploads a photo (JPG, PNG, WebP) or PDF of a supplier bill, Gemini reads it, the owner reviews every line, and only then is it recorded as a purchase (SPEC 5.1, 9.8).

- **Upload** (`POST /api/businesses/[businessId]/invoices`, multipart `file`): `requireUser()` → `requireBusinessOwner()` first. Files are checked by size (≤ 4 MB, under serverless request limits) and by their real type from the first bytes, not only the browser's label. The file is sent once, inline, to the AI service and is **not stored** (`filePath` is always `null`), so no Storage bucket or Blaze plan is needed and no invoice file can become public.
- **Reading** (`src/server/invoices.ts`, `extractDocumentJson` in `src/server/ai/provider.ts`): the model returns JSON only (supplier, number, date, lines, subtotal, tax, total, what it could not read). `src/lib/invoices.ts` validates it, converts amounts to integer minor units and **flags instead of guessing**: missing supplier/date/total, impossible or future dates, non-whole quantities, line totals that do not match quantity × unit price, lines that do not add up to the subtotal, subtotal + tax ≠ total (1 rupee rounding allowed), and not-an-invoice documents.
- **Review** (`/invoices/[invoiceId]`): saved as `invoices/{id}` with `reviewStatus: "needs_review"`. The owner picks an existing supplier (suggested by name) or a new one, checks the date, matches each line to a product (suggested by name), fixes quantity/unit/cost or skips the line, and sees the kept total against the printed total.
- **Confirm** (`POST …/invoices/[invoiceId]/confirm`): reuses `recordPurchaseForBusiness`, so stock goes up, product costs follow the purchase and `purchases.sourceDocumentId` links back to the invoice. Idempotent on a client `purchaseId`; a new supplier is created at most once per invoice. A confirmed invoice cannot be confirmed again with another purchase; a discarded one cannot be confirmed.
- **Discard** (`DELETE …/invoices/[invoiceId]`): marks the scan `discarded`; nothing else changes.
- **Limits**: `AI_INVOICE_DAILY_LIMIT` scans per user per day (default 15, `aiUsage/{uid}_{date}_invoices`) → 429. No `AI_API_KEY` → 503 "not configured".

Tests: `src/lib/invoices.test.ts` (amount parsing, every flag, product/supplier suggestions) and `tests/invoices.test.ts` (auth, other owners get 404 and the AI is never called, real file-type check, size limit, nothing recorded before confirm, confirm adds stock once, new supplier created once, cross-business products rejected, discard, daily limit).

## How authentication works

- The client signs in with Firebase Auth (email/password), then exchanges its ID token at `POST /api/auth/session` for an **httpOnly, sameSite=lax session cookie** created by the Admin SDK (`secure` in production). The server never trusts a client-sent UID.
- `GET/DELETE /api/auth/session` is the only session endpoint; `DELETE` also revokes refresh tokens so old sessions die everywhere.
- `POST /api/auth/session` creates `users/{uid}` on first sign-in (SPEC.md 9.1).
- Protected pages (`/dashboard`, `/onboarding`) verify the cookie on the server inside a `<Suspense>` boundary (Next.js 16 `cacheComponents`) and redirect signed-out visitors to `/sign-in`.
- All business-data routes go through `src/server/`: `requireUser()` → 401 when signed out, `requireBusinessOwner(businessId)` → 404 when the business is missing **or** owned by someone else (so account A cannot probe account B's businessIds). `ownerId` is always taken from the verified session, never from the request body.
- Firestore and Storage rules stay **deny-by-default**; all data access is via the Admin SDK after explicit ownership checks.

## How business records work

- Every record lives in a top-level collection (`products`, `sales`, `expenses` — SPEC.md 9.3–9.5) with a `businessId` field. Each API route runs `requireUser()` then `requireBusinessOwner(businessId)` before touching data, so a client-sent `businessId` or `ownerId` in a body is never trusted.
- **Money is integer minor units** (paisa) end to end (`src/lib/money.ts`); forms send decimal strings that the server parses without floating point. Calculations (sale totals, gross profit, low stock) are pure functions in `src/lib/calculations.ts`, unit-tested, and never delegated to AI.
- Recording a sale runs in a **Firestore transaction**: products are read before any write, stock can not go negative, and the client-generated `saleId` is used as the document id so retries are idempotent.
- All queries filter by `businessId` only (no composite indexes needed); sorting happens in memory.
- **Platform Administrator** is a Firebase custom claim (`platformAdmin`), settable only via CLI, never from the UI or requests:

  ```bash
  node --env-file=.env.local scripts/set-admin-claim.mjs <email-or-uid> [--revoke]
  ```

- **2FA:** investigated, not implemented. Findings and recommendation (TOTP via Identity Platform; requires a Blaze upgrade approval): [docs/2fa-investigation.md](docs/2fa-investigation.md).

## Requirements

- Node.js 24 (tested with v24.22.0) and npm.
- Optional: [CodeGraph](https://github.com/colbymchenry/codegraph) CLI (`npm i -g @colbymchenry/codegraph`). The Claude Code config in `.mcp.json` and `.claude/settings.json` expects it on your PATH.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real Firebase values (never commit)
npm run dev                  # http://localhost:3000
```

The home page renders without environment variables, but sign-in and the workspace need both halves of the Firebase config:

- **Public web config** (`NEXT_PUBLIC_FIREBASE_*`): Firebase console → Project settings → Your apps → Web app.
- **Service account** (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`): Firebase console → Project settings → Service accounts → Generate new private key.

Also enable **Email/Password** under Firebase console → Authentication → Sign-in method. `.env.local` is git-ignored; only `.env.example` placeholders are tracked.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run check` | All of the above |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Firebase Authentication, Cloud Firestore, Cloud Storage for Firebase, Vitest. AI: Google Gemini API via REST (free tier). Hosting is still to be decided (SPEC.md section 10).

## Security notes

- Never commit `.env.local` or service-account keys. Only `.env.example` with placeholders is tracked.
- Firestore and Storage rules deny all access by default.
- Server secrets must never use the `NEXT_PUBLIC_` prefix.
