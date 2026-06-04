# CLAUDE.md — Creditly Internal Platform

Internal platform + banking auction module. Take-home assignment.

**Priorities by grade weight:** Backend architecture (25%) + RBAC (25%) > Auction (15%)
+ Business logic (15%) > Integration (10%) > Frontend (5%) > README (5%).

## Tech Stack
- Backend: Node.js + TypeScript (strict), **Hono** (+ `@hono/node-server`, `@hono/zod-validator`)
- DB: PostgreSQL + Prisma
- Auth: JWT in httpOnly cookie
- Frontend: Next.js (App Router) + Tailwind, Axios, React Context
- Tests: Vitest + Hono testing client (`app.request`)
- Package manager: **npm**

## Commands
- `npm run dev`        # backend dev (tsx watch)
- `npm run build`      # tsc
- `npm test`           # vitest
- `npm run db:migrate` # prisma migrate dev
- `npm run db:seed`    # seed one user per role + banks + accounts

## Architecture — Clean Architecture (strict)
`controllers → services → repositories → prisma`
- **Controllers**: HTTP only (parse, validate, call service, shape response). No business logic.
- **Services**: all business logic + orchestration. The ONLY layer that calls `integration/` and `events/`.
- **Repositories**: Prisma access only. No business rules.
- `integration/` and `events/` are invoked from services, **NEVER** from controllers.

## RBAC — enforced server-side, ALWAYS (non-negotiable)
- Roles: `ADMIN | MANAGER | USER | BANKER`.
- **Banker NEVER receives customer PII** (name/phone/email). Use role-aware serializers —
  never return a raw entity to a banker. No direct Account access for bankers.
- Banker sees only auctions that are `OPEN` and match their bank eligibility.
- Manager: only assigned accounts; can open/close auctions. User: only related data; can create events.
- Frontend RBAC is cosmetic only — the **server is the source of truth**.

## Domain Rules (must hold)
- Auction model: **Blind** — no banker sees others' offers. Duration = **3 days**.
- No offers after expiry (`endsAt`).
- Best offer = **lowest interest rate**. Deterministic tie-break:
  `ORDER BY interestRate ASC, createdAt ASC, id ASC` (stable & reproducible in tests).
- Auction close: pick winner → account `WON` + `winning_offer_selected` event + CRM sync.
  No offers → `EXPIRED`.
- **>3 events in 24h** on an account → `isHighActivity = true`.
- `document_uploaded` → update `lastActivity` + trigger CRM sync.
- Event types: `document_uploaded`, `status_changed`, `note_added`, `auction_opened`,
  `offer_submitted`, `auction_closed`.

## Schema Rules (Prisma)
- All enum values are **UPPERCASE** (`OPEN`, `CLOSED`, `EXPIRED`, `WON`, `FAILED`, …) so the
  DB enum matches the TS code exactly — no drift.
- Timestamps use `@db.Timestamptz(6)` (millisecond+ precision). **Never round/truncate times** —
  the auction tie-break depends on submission order.

## Integration (Mock CRM)
- Single `integration/crmService.sync(trigger, payload)`. Triggers: `status_changed`,
  `document_uploaded`, `auction_opened`, `winning_offer_selected`.
- Wrapped in a **retry-with-backoff** queue. On final failure → `SyncLog{ status: FAILED, failureReason }`.

## Conventions
- TS strict; validate **every** input with zod at the edge (`@hono/zod-validator`).
- Central error handler via `app.onError` → consistent JSON `{ error, code }`.
- Never log secrets/PII. Keep functions small; name by domain.

## Never
- Never call `integration/` or `events/` from a controller.
- Never return customer PII to a `BANKER`.
- Never trust the client for authorization.
- Never commit `.env` (only `.env.example`).
