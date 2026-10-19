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

Suppliers, purchases, invoices and the AI assistant come in later phases.

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

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Firebase Authentication, Cloud Firestore, Cloud Storage for Firebase, Vitest. The AI provider and hosting are still to be decided (SPEC.md section 10).

## Security notes

- Never commit `.env.local` or service-account keys. Only `.env.example` with placeholders is tracked.
- Firestore and Storage rules deny all access by default.
- Server secrets must never use the `NEXT_PUBLIC_` prefix.
