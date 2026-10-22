# AI Disclosure

This file explains how Elevate uses AI inside the product, and how AI tools were used to build it.

## 1. AI inside the product

| | |
|---|---|
| Features | Business assistant chat (`/dashboard/[businessId]/assistant`) and invoice reading (`/dashboard/[businessId]/invoices`) |
| Provider | Google Gemini API (Google AI Studio), free tier |
| Model | `gemini-3.5-flash-lite` by default (configurable with `AI_MODEL`) |
| Called from | The server only (`src/server/ai/provider.ts`). The API key never reaches the browser. |

### What the AI does

- Explains the owner's own business figures in simple English, Urdu or Roman Urdu.
- Gives general, low-cost suggestions (for example, ideas to increase sales).
- Reads an uploaded supplier invoice (photo or PDF) and lists the supplier, date, items, quantities and prices it can see, plus what it could not read.

### What the AI does not do

- It does **not** calculate any number. Revenue, cost of goods sold, gross profit, expenses, estimated net profit, stock levels and restock estimates are calculated by deterministic, unit-tested application code (`src/lib/`). The same calculations power the dashboard. The AI only quotes them.
- It cannot create, change or delete business records, publish anything or spend money. An invoice it read only becomes a purchase after the owner reviews every line and presses Confirm.
- It does not decide whether invoice figures are correct: the app checks the arithmetic (line totals, subtotal, tax, total) and flags anything that does not add up.
- It is not professional accounting, tax or legal advice. Answers are labelled "AI-generated" in the app.

### Data sent to the AI provider

Only what is needed to answer a question about the signed-in owner's own business:

- Business name, business type, currency and today's date.
- This month's and last month's calculated totals, plus data-quality warnings.
- Top-selling products this month, low-stock products with restock estimates, and up to 40 products (name, stock, selling price and low-stock level).
- The owner's question and up to the last 6 messages of the same conversation.

For invoice reading, the uploaded file itself is sent once, inline, together with fixed reading instructions. No other business data is sent with it.

Never sent: owner id, email or password; other businesses' data; supplier contact details; individual purchase or sale lines; file paths; API keys.

### Provider data use

On the Gemini API **free tier**, Google states that content may be used to improve its products (see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), "Used to improve our products"). Do not enter information in the assistant, or upload invoices, that you would not want shared with Google. A paid tier changes this; check Google's current terms before switching.

### Storage

Questions and answers are saved in Firestore (`aiConversations`), visible only to the owner who asked them, with a snapshot of the figures used. Owners can delete their conversations from the assistant page.

Uploaded invoice files are **not stored** by Elevate. Only what was read from them (and the owner's review status) is saved in Firestore (`invoices`), visible only to the business owner.