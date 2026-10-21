# AI Disclosure

This file explains how Elevate uses AI inside the product, and how AI tools were used to build it.

## 1. AI inside the product

| | |
|---|---|
| Feature | Business assistant chat (`/dashboard/[businessId]/assistant`) |
| Provider | Google Gemini API (Google AI Studio), free tier |
| Model | `gemini-3.5-flash-lite` by default (configurable with `AI_MODEL`) |
| Called from | The server only (`src/server/ai/provider.ts`). The API key never reaches the browser. |

### What the AI does

- Explains the owner's own business figures in simple English, Urdu or Roman Urdu.
- Gives general, low-cost suggestions (for example, ideas to increase sales).

### What the AI does not do

- It does **not** calculate any number. Revenue, cost of goods sold, gross profit, expenses, estimated net profit, stock levels and restock estimates are calculated by deterministic, unit-tested application code (`src/lib/`). The same calculations power the dashboard. The AI only quotes them.
- It cannot create, change or delete business records, publish anything or spend money.
- It is not professional accounting, tax or legal advice. Answers are labelled "AI-generated" in the app.

### Data sent to the AI provider

Only what is needed to answer a question about the signed-in owner's own business:

- Business name, business type, currency and today's date.
- This month's and last month's calculated totals, plus data-quality warnings.
- Top-selling products this month, low-stock products with restock estimates, and up to 40 products (name, stock, selling price and low-stock level).
- The owner's question and up to the last 6 messages of the same conversation.

Never sent: owner id, email or password; other businesses' data; supplier contact details; individual purchase or sale lines; documents or file paths; API keys.

### Provider data use

On the Gemini API **free tier**, Google states that content may be used to improve its products (see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), "Used to improve our products"). Do not enter information in the assistant that you would not want shared with Google. A paid tier changes this; check Google's current terms before switching.

### Storage

Questions and answers are saved in Firestore (`aiConversations`), visible only to the owner who asked them, with a snapshot of the figures used. Owners can delete their conversations from the assistant page.

## 2. AI tools used to build Elevate

<!-- TODO (team): list every AI tool/model each member used, for which phases, and confirm the list is complete. -->

- **Claude Code (Anthropic, Claude Opus 5.5)**: implemented Phase 6 (AI assistant, conversations, rate limit, tests, documentation) and the two Phase 5 follow-up fixes.
- **Devmarketplace AI agents**: used for earlier phases. _TODO: add the models and phases._

All AI-written code was reviewed by the team and checked with `npm run check` (lint, typecheck, unit tests, production build).
