# AGENTS.md — Elevate Project Instructions

## 1. Project Mission

Elevate is an AI-powered business management assistant for small business owners in Pakistan. It helps business owners organize records, manage inventory, analyze invoices, track suppliers, calculate financial performance, and make better-informed decisions using accessible AI assistance.

Build a secure, reliable, and usable product—not disconnected demo screens. The main user journey must combine persistent business data, reliable application logic, and a real hosted AI model call.

## 2. Source of Truth

Before making changes:

1. Read `SPEC.md` completely.
2. Inspect the existing repository, source files, package scripts, dependencies, Git status, and current architecture.
3. Treat `SPEC.md` as the source of truth for product behavior, scope, roles, and data model. Treat the existing repository as the source of truth for current implementation and conventions.
4. If existing code conflicts with `SPEC.md`, report the conflict before making major changes. Do not silently change either one.
5. Older planning documents (for example, the "Complete Project Planning Report" PDF) are background only. Where they conflict with `SPEC.md`—such as multi-role RBAC, Firestore subcollections, or sales-invoice workflows—`SPEC.md` wins.
6. Preserve working code and existing project history. Do not rewrite the application unnecessarily.
7. Locate and preserve the original logo assets:
   - `elevate_logo_for_dark_theme.svg`
   - `elevate_logo_for_light_theme.svg`

Use the actual repository paths for these logos. Do not redraw, replace, or rename them without approval.

Note: both logo files are SVG wrappers around an embedded PNG image, not true vector artwork. They may look soft at very small sizes (favicons, app icons). Report this instead of tracing or regenerating the logo.

## 3. Planning and Phased Implementation

Use Planning mode for architecture, research, and phase planning.

Before implementation:

- Break the project into small, ordered phases.
- Identify dependencies, risks, expected files, and verification steps.
- Prioritize a complete end-to-end user journey over numerous incomplete features.
- Implement only the currently approved phase.
- Inspect existing work before generating or replacing files.
- Stop after each phase and report the results for review.

Every phase report must include:

1. Goal and implemented behavior.
2. Files created or changed.
3. Tests and commands actually run.
4. Results and known limitations.
5. Security and privacy considerations.
6. Suggested next phase.

Do not automatically proceed to the next phase without approval.

## 4. MVP Priorities

Follow `SPEC.md` section 13.1 for the intended MVP scope:

1. Owner sign-up, sign-in, and business profile.
2. Invoice upload and owner-reviewed extraction.
3. Product and inventory tracking with low-stock alerts.
4. Supplier and purchase records, including comparisons from available data.
5. Sales, expenses, and profit/pricing calculations.
6. Simple business dashboard and reports.
7. AI chatbot grounded in the owner's authorized business data.
8. English, Urdu, and Roman Urdu experience.
9. Secure storage and owner-only access.

`SPEC.md` also includes AI forecasting (5.6) and an AI marketing assistant (5.7). Build them after the items above work end to end.

### Hackathon requirements (not yet in `SPEC.md`)

The following are hackathon requirements in addition to `SPEC.md`. Treat them as mandatory:

- Two-factor authentication (2FA) on top of required authentication (see section 10).
- A real API call to a hosted AI model during the main user journey (see section 5).
- Saving the AI result so it remains available after signing out and signing in again.
- A stable, deployed end-to-end journey.
- At least two published Devmarketplace code gigs (see section 14).
- An `AI_DISCLOSURE.md` file (see section 14).

Suggested build order: authentication and workspace isolation → persistent records → inventory → sales, expenses, purchases, and suppliers → calculations → dashboard → grounded AI with saved results → invoice extraction → 2FA hardening → deployment.

Do not claim a feature is complete because its UI exists. Distinguish implemented, partially implemented, mocked, and unverified functionality.

## 5. AI Must Be Core to Elevate

AI is a core product capability, not an unrelated chatbot.

The deployed application must make a real API call to a hosted AI model during the main user journey.

For business-specific AI requests:

1. Authenticate the user on the server.
2. Verify that the user owns or is authorized to access the selected business.
3. Retrieve only the relevant records from that authorized workspace.
4. Calculate financial totals using deterministic application code.
5. Send the minimum necessary business context to the hosted AI model.
6. Validate the response and handle failures safely.
7. Explain results in understandable language.
8. Identify missing data and uncertainty.
9. Save useful results when required by the user journey.
10. Ensure saved answers are available only to authorized users.

Do not use hardcoded responses, fake AI outputs, or mock integrations as substitutes for a real hosted-model call.

Do not claim AI integration is complete until it has been tested in the application.

## 6. Free-First Cost Policy

The project must prioritize free services and avoid unexpected costs.

- Prefer usable free tiers and existing tools.
- Verify current pricing, quotas, and plan restrictions before depending on a service.
- Never enable paid billing, purchase credits, or upgrade a subscription without explicit approval.
- Do not assume that an IDE's AI credits provide free API access to the deployed application.
- Do not claim a hosted AI API, 2FA method, database feature, storage service, or hosting plan is free without verifying the actual requirements.
- If a required capability cannot be provided within the free constraint, explain the blocker and propose realistic alternatives.
- Never silently remove, fake, or bypass a mandatory requirement to avoid its cost.
- Known pricing risks to verify before committing to a design:
  - Firebase multi-factor authentication requires upgrading to Firebase Authentication with Identity Platform, which may require a billing-enabled (Blaze) project.
  - SMS-based second factors are billed per message.
  - Cloud Storage for Firebase may require the Blaze plan for new projects.
  - Each AI provider has its own free-tier quotas and data-usage terms.

Use AI tokens efficiently. Inspect files before editing, make focused changes, avoid repeated rewrites, and run relevant checks before expanding the scope.

## 7. Technology Direction

Follow the existing repository and `SPEC.md`.

The intended technology stack is:

- Frontend: Next.js, React, TypeScript, and Tailwind CSS.
- Backend: Next.js server-side logic and API Route Handlers.
- Authentication: Firebase Authentication.
- Database: Cloud Firestore.
- File storage: Cloud Storage for Firebase, subject to current plan and project requirements.
- AI: A hosted model called securely from server-side code. The provider is not yet decided (`SPEC.md` section 10). Keep provider-specific code behind a small server-side adapter so the provider can be changed without touching features.
- Version control: Git and GitHub.
- Hosting: A compatible deployment platform that satisfies the project's requirements and cost constraints.

Inspect existing dependencies before adding packages. Do not migrate frameworks or replace services without a clear reason and approval.

## 8. Data Security and Privacy

- Every private business record must belong to an authorized business workspace.
- A client-provided `businessId` is not proof of authorization.
- Verify user identity and workspace ownership on the server.
- Apply restrictive Firestore and Storage security rules where applicable.
- The Firebase Admin SDK bypasses security rules. Server code using it must check ownership explicitly on every request.
- Only use client-side Firestore or Storage access where security rules fully enforce ownership.
- Only the Platform Administrator role (a server-verified custom claim or a restricted record) may perform platform operations. Never grant that role based on client input.
- Deny access by default and grant only required permissions.
- Never expose private keys, service-account credentials, or hosted AI API keys in frontend code or Git.
- Keep invoice files private.
- Validate user inputs, quantities, monetary values, document references, and uploaded files. Uploaded files must be checked for allowed types (supported images and PDF) and size limits.
- Avoid logging unnecessary private business information.
- Do not send unrelated business records to the AI provider.
- Treat invoice-extracted information as unconfirmed until the owner reviews it.
- Prevent duplicate requests from recording transactions or deducting inventory more than once.
- Test that two different accounts cannot access one another's business data.

Platform administrators support service operations and must not have routine access to private invoices, supplier prices, inventory costs, or profit reports. Exceptional support access must be limited and audited where implemented.

## 9. Financial Accuracy

Use application code—not the AI model—as the source of truth for financial arithmetic.

- Store money as integers in the smallest currency unit (for example, paisa for PKR). Never use binary floating-point for authoritative totals. Format for display only at the edge.
- Keep calculation logic in pure, unit-tested functions, separate from UI and database code.
- Sales reduce stock and confirmed purchases increase stock. Each stock change must be atomic (a Firestore transaction) and idempotent so that a retried request cannot deduct or add stock twice.
- Prevent negative stock by default. Make any exception explicit and visible to the owner.

- Calculate sales totals from validated line items.
- Calculate recorded expenses from saved expense records.
- Define the cost basis used for gross profit.
- Distinguish gross profit from net profit.
- Show assumptions and missing expense information.
- Handle rounding and zero denominators safely.
- Never invent missing financial values.
- Do not present an incomplete calculation as a complete net-profit figure.
- Compare supplier prices only when products, units, quantities, and relevant source information are sufficiently comparable.
- Do not claim live market-price verification without a reliable, current data source.
- Label forecasts as estimates, not guarantees.

AI can explain calculated results and offer suggestions, but it must not fabricate or silently override them.

## 10. Authentication and 2FA

Working authentication and 2FA are mandatory hackathon concerns.

- Inspect the actual Firebase project and available authentication methods.
- Verify the chosen 2FA method and its plan requirements before implementation.
- Do not assume 2FA is included in the current free configuration.
- Do not describe ordinary email/password sign-in as 2FA.
- Never build a fake second-factor screen or a bypass that only appears to satisfy the requirement.
- If a required 2FA capability conflicts with the free-first constraint, report the exact blocker before committing to the design.
- Test registration, sign-in, sign-out, session restoration, second-factor setup, and actual second-factor use.
- Test data isolation with at least two separate accounts.

## 11. Database and Data Model

Follow the data model in `SPEC.md` section 9. It uses top-level Firestore collections. Every business-owned document carries a `businessId` field, and ownership is checked through `businesses/{businessId}.ownerId`. Do not switch to subcollections without approval.

Core collections:

- `users`
- `businesses`
- `products`
- `sales`
- `expenses`
- `suppliers`
- `purchases`
- `invoices`

Optional supporting collections from `SPEC.md` 9.9:

- `inventoryMovements`
- `aiConversations` (use this name; it also holds saved AI results)
- `auditLogs`
- `platformSettings`

In `SPEC.md`, `invoices` means uploaded supplier or purchase documents and their extraction review. It does not mean sales invoices issued to customers. Use `reviewStatus` to keep extracted data separate from confirmed records. Only a confirmed invoice may create or update `purchases` and stock.

Every query on business data must filter by `businessId`. Create composite indexes from real query patterns and keep `firestore.rules`, `storage.rules`, and `firestore.indexes.json` in the repository.

Use consistent IDs, validated references, and timestamps. Document deliberate schema changes. Verify that records survive reloads and later sign-ins before claiming persistence.

## 12. Interface and Branding

Use the Elevate colors specified in `SPEC.md`:

- Electric Lime: `#C6FF00`
- Carbon Black: `#080A08`
- Graphite: `#171B16`
- Soft White: `#F6F8F4`

Define colors once as theme tokens (CSS variables or Tailwind theme) for both light and dark themes. Do not scatter hex values through components.

- Use lime for primary actions, selected states, and focus. Do not fill every card with it.
- Lime has low contrast on white. Put dark text on lime buttons, and never use lime as text on light backgrounds.
- Meet WCAG AA contrast.
- Never show status (profit or loss, low stock, errors) by color alone. Pair it with text or an icon.

Use the supplied light and dark SVG logos in the appropriate themes.

The interface should be responsive, accessible, consistent, and easy for small business owners to understand.

Include clear loading, empty, success, and error states. Avoid fabricated dashboard values and placeholder content presented as real business data.

English, Urdu, and Roman Urdu are part of the MVP (`SPEC.md` 13.1). Only claim support for a language to the extent it has been tested with representative questions. Urdu text needs a font that supports Urdu script and correct right-to-left handling wherever Urdu UI text is shown.

Every metric must say whether it is recorded, estimated, or incomplete. Every report must show its date range.

## 13. Code Quality

- Follow existing project conventions.
- Use TypeScript types for domain models and API contracts.
- Separate UI, data access, calculations, authorization, and AI integration.
- Validate inputs at trust boundaries.
- Prefer focused reusable components over duplicated logic.
- Add relevant tests for calculations, authorization, and the core user journey.
- Run available lint, typecheck, tests, and build commands.
- Report checks accurately; never claim a command passed unless it was run successfully.
- Never commit secrets, private credentials, or real customer invoices.
- Keep `.env.example` limited to placeholder values.
- Never put server secrets in `NEXT_PUBLIC_*` variables. Only the public Firebase web config may be exposed to the client.
- API errors must return safe messages with appropriate status codes (400, 401, 403, 404, 409, 429, 500). Never return stack traces or raw provider errors.
- Update documentation when architecture, setup, or behavior changes.
- Make small, meaningful Git commits with descriptive messages.
- Do not rewrite or delete existing Git history without approval.

## 14. Open-Source and Devmarketplace Reuse

Reuse existing components when they genuinely improve development speed or reliability.

Before adopting a component:

- Check compatibility and integration effort.
- Review security, maintenance, and licensing.
- Preserve required attribution.
- Document reused components and known licenses or source links in `AI_DISCLOSURE.md`.
- Do not claim a component is integrated until it is used and tested.

The hackathon requires at least two published code gigs created from code written by the team during the event. Prepare genuinely reusable components with clear descriptions, setup instructions, dependencies, and contributor credit. Do not claim a gig is published until it actually is.

## 15. Agent Instructions and Skills

- Treat this file as the project's general development guidance.
- Put detailed repeatable workflows in focused skill files supported by the agent platform.
- Inspect Devmarketplace's actual skill discovery conventions before deciding where skill files belong.
- Avoid duplicating the entire specification in every skill.
- Keep `SPEC.md`, `AGENTS.md`, and skills consistent.
- Report conflicts instead of silently choosing contradictory instructions.
- Never invent unavailable platform tools or capabilities.

## 16. Commands

Keep this list current when scripts change.

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run test` | Unit tests once (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run build` | Production build |
| `npm run check` | Lint, typecheck, test and build in one go; run before every phase report |
| `npx firebase-tools emulators:start` | Local Auth, Firestore and Storage emulators (needs Java; not yet used) |

Deployment commands will be added when hosting is chosen.

### Project layout

- `src/app/`: routes, layouts and Route Handlers (`src/app/api/...`).
- `src/components/`: shared UI (`brand/`, `theme/`, ...).
- `src/features/<feature>/`: feature UI and client logic (inventory, sales, invoices, ai, ...).
- `src/lib/`: shared helpers (`money.ts`, `env/`, `firebase/`).
- `src/server/`: server-only business logic, data access, authorization and the AI adapter. Every file imports `server-only`.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`: Firebase config, kept in the repo.
- `.agents/skills/`: installed agent skills (see `skills-lock.json`). Third-party; excluded from lint.

### Stack notes

- This is Next.js 16 with `cacheComponents` and `partialPrefetching` enabled. Data fetching is dynamic by default. Read `node_modules/next/dist/docs/` before using caching, routing or data APIs (see the block at the end of this file).
- Do not add export const runtime = ... (or other route segment configs such as dynamic or revalidate) to any route or page. With cacheComponents enabled the build fails on them, and routes already run on Node.js.
- Money helpers live in `src/lib/money.ts`. Use them for all amounts.
- `src/lib/firebase/admin.ts` bypasses security rules. Only call it after verifying identity and ownership.

## 17. Definition of Done

A phase is ready for review only when:

- Its intended behavior is implemented, not mocked.
- Relevant data and authorization boundaries are enforced.
- Important errors and empty states are handled.
- Relevant checks have actually been run.
- Documentation and environment examples are updated where needed.
- No secrets or private test data have been committed.
- Changed files, test results, limitations, and the next proposed phase are reported.

Stop after the phase report and wait for approval before continuing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
