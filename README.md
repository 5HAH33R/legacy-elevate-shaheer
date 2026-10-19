# Elevate

AI-powered business management assistant for small business owners in Pakistan.

- Product specification: [SPEC.md](SPEC.md)
- Rules for contributors and AI agents: [AGENTS.md](AGENTS.md)

## Status

Phase 1 (foundation) only. The app shows a branded placeholder page with light and dark themes. Sign-in, business records and the AI assistant are not built yet.

## Requirements

- Node.js 24 (tested with v24.22.0) and npm.
- Optional: [CodeGraph](https://github.com/colbymchenry/codegraph) CLI (`npm i -g @colbymchenry/codegraph`). The Claude Code config in `.mcp.json` and `.claude/settings.json` expects it on your PATH.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values when Firebase is connected (Phase 2)
npm run dev                  # http://localhost:3000
```

The placeholder page does not need any environment variables.

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
