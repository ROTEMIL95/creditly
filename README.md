# Creditly — Internal Platform & Banking Auction Module

An internal system to manage customer cases (accounts), system events, and a secure
**banking auction module** with Role-Based Access Control (RBAC). The emphasis is on
**backend architecture, real RBAC, event-driven business logic, and a dedicated
integration layer** — the UI is intentionally minimal.

---

## 🧱 Tech Stack & Decisions

### Backend
- **Runtime / Language:** Node.js + TypeScript (strict)
- **Framework:** **Hono** — a lightweight, first-class-TypeScript web framework. Built-in
  middleware composition, `@hono/zod-validator` for request validation, and `app.onError`
  for centralized error handling. Runs on Node via `@hono/node-server`.
- **Authentication:** JWT (`hono/jwt`), delivered as an httpOnly cookie **and** returned in
  the body so non-cookie clients (and tests) can use a `Bearer` header.

### Database
- **Database:** PostgreSQL (hosted on **Supabase** — managed Postgres)
- **ORM:** Prisma (type-safe queries + migrations)
- **Why SQL?** The domain needs strict relational integrity between Users, Banks, Accounts,
  Auctions, and Offers, plus **ACID guarantees** for auction matching / tie-breaking. A
  relational engine models this far more safely than a document store.

### Frontend
- **Next.js 15 (App Router) + TypeScript**, Tailwind CSS, Axios, React Context for auth.
- Deliberately basic: role-based navigation, loading/error states, no visual polish.

### Testing
- **Vitest** — 16 tests covering the mandated scenarios (see [Testing](#-testing)).

---

## 📐 Architecture (Clean Architecture)

Strict separation of concerns with a one-directional dependency flow:

```
controllers  →  services  →  repositories  →  Prisma
                   │
                   ├── events/        (domain dispatcher + business rules)
                   └── integration/   (Mock CRM sync)
```

```
backend/src/
├── controllers/   # HTTP only: parse input, call a service, shape the response
├── services/      # ALL business logic + orchestration
├── repositories/  # Prisma data access only (no business rules)
├── serializers/   # role-aware DTOs — the single place PII is masked
├── events/        # eventDispatcher: persists events, runs business rules, fires triggers
├── integration/   # crmService: Mock CRM with retry/backoff (never called from controllers)
├── middlewares/   # requireAuth (JWT) + requireRole (RBAC)
├── routes/        # Hono routers + zod validation
├── lib/           # errors, jwt, password, http helpers
├── config/        # env validation, Prisma client
└── app.ts / server.ts
```

**Key rule:** `integration/` and `events/` are invoked **only from services**, never from
controllers. Controllers stay thin; business rules live in one layer.

---

## 🗄️ Database Design

| Entity | Purpose | Key fields |
|---|---|---|
| **User** | System user | `role` (ADMIN/MANAGER/USER/BANKER), `bankId?` (bankers) |
| **Bank** | A bidding bank | `name`, `minAmount` (eligibility threshold) |
| **Account** | Customer case | `customerName/phone/email` (**PII**), `status`, `managerId`, `isHighActivity`, `lastActivity`, `amount` |
| **Event** | System action | `type` (6 types), `payload`, `accountId`, `createdById` |
| **AuctionOpportunity** | Auction entity | `status` (OPEN/CLOSED/EXPIRED/WON), `startsAt`, `endsAt`, `winningOfferId?` |
| **BankOffer** | A bank's bid | `interestRate`, `bankId`, `bankerId`, `isWinner` — `@@unique([auctionId, bankerId])` |
| **SyncLog** | Integration audit | `trigger`, `status` (SUCCESS/FAILED), `failureReason?`, `attempts` |

Relationships: `User 1—* Account` (manager), `Account 1—* Event`, `Account 1—* AuctionOpportunity`,
`AuctionOpportunity 1—* BankOffer`, `Bank 1—* BankOffer`.

**Schema conventions:**
- All enum values are **UPPERCASE** so the DB enum matches the TypeScript enum exactly (no drift).
- Timestamps use `@db.Timestamptz(6)` (sub-millisecond precision) and are **never rounded** —
  the auction tie-break depends on submission order.

---

## 🔐 RBAC (enforced server-side)

Authorization is enforced in the backend at two levels: **`requireRole` middleware** (coarse,
per-endpoint) + **role-aware serializers** (so a banker can never receive PII even by accident).
The frontend only *hides* controls — the server is the source of truth.

| Capability | Admin | Manager | User | Banker |
|---|:--:|:--:|:--:|:--:|
| List / view accounts | ✅ all | ✅ assigned only | ✅ related only | ❌ no direct access |
| Open / close auction | ✅ | ✅ (own accounts) | ❌ | ❌ |
| Create events | ✅ | ✅ | ✅ | ❌ |
| View auctions | ✅ | ✅ | related | ✅ **open + bank-eligible only** |
| Submit offers | ❌ | ❌ | ❌ | ✅ (open, not expired) |
| See customer **PII** | ✅ | ✅ | ✅ | ❌ **masked** |
| See other banks' offers | ✅ | ✅ | — | ❌ |

> **Bankers never see** customer name/phone/email, can't access accounts directly, and see
> only an offer **count** ("competitors hidden") plus their own offer.

---

## ⚖️ Auction Module

**Flow:** account eligible → manager opens auction → eligible bankers see it → bankers submit
offers → manager closes → winner selected.

**Model: Blind** (chosen). Bankers submit offers but cannot see any other offers. This is the
simplest model to implement *correctly* and it directly satisfies the RBAC rule that a banker
must not see competitors' bids. Bankers may **update** their own offer while the auction is open.
- *Trade-off vs Open:* no live competitive price pressure, but stronger confidentiality and a
  simpler, more auditable flow — the right call for a security-focused assignment.

**Rules:**
- Duration = **3 days** (`endsAt = startsAt + 3d`). No offers accepted after `endsAt`.
- **Best offer = lowest interest rate.** Deterministic tie-break:
  `interestRate ASC, createdAt ASC, id ASC` — so equal-rate / same-instant submissions still
  resolve stably and reproducibly (this is a pure, unit-tested function: `services/auctionLogic.ts`).
- No offers → auction `EXPIRED`. Winner chosen → account `WON` + `AUCTION_CLOSED` event +
  `WINNING_OFFER_SELECTED` CRM sync.

---

## ⚙️ Business Logic (mandatory)

Centralized in the **event dispatcher** (`events/eventDispatcher.ts`) and `auctionService`:
- **> 3 events in 24h on an account → `isHighActivity = true`.**
- **`DOCUMENT_UPLOADED` → update `lastActivity` + trigger CRM sync.**
- **Auction close → select best offer** (rules above).

---

## 🔌 Integration Layer (Mock CRM)

A dedicated service (`integration/crmService.ts`), **never called from a controller**. A single
`sync(trigger, payload)` entry point, triggered on `STATUS_CHANGED`, `DOCUMENT_UPLOADED`,
`AUCTION_OPENED`, and `WINNING_OFFER_SELECTED`.

**Bonus — Queue / retry:** each sync is wrapped in a **retry-with-exponential-backoff** loop.
After the final attempt fails, the failure is persisted to **`SyncLog`** with
`status=FAILED`, the `failureReason`, and the number of `attempts`. A configurable
`CRM_FAIL_RATE` env var lets you exercise the failure path.

---

## 🎁 Bonus Features

The assignment lists three optional bonuses. Status in this project:

| Bonus | Status | Where / notes |
|---|---|---|
| **Queue / retry** | ✅ retry implemented | `integration/crmService.ts` — retry + exponential backoff, outcome persisted to `SyncLog`. A durable broker (Redis/RabbitMQ) is **not** included; the retry loop is the documented swap-in point. |
| **Audit trail** | ✅ via `Event` + `SyncLog` | Every domain action is an immutable `Event` row (who/what/when); every integration attempt is a `SyncLog` row. A generic field-level change log (CDC) is the further step. |
| **Cloudflare stack** | ⚠️ documented, not deployed | Not deployed in this submission. Path below. |

### Queue / retry (✅)
`crmService.sync()` retries up to `CRM_MAX_RETRIES` with `CRM_RETRY_BASE_MS * 2^n` backoff,
then records `SyncLog{ status: FAILED, failureReason, attempts }`. Covered by a unit test.
**Production evolution:** publish events to a durable queue and process via a worker (move the
side-effect off the request path); the dispatcher is the single seam where this is swapped in.

### Audit trail (✅)
- **`Event`** — append-only record of every system action: `type`, `accountId`, `createdById`,
  `createdAt` (+ JSON `payload`). This is the domain audit trail (who did what, when).
- **`SyncLog`** — audit of every external sync attempt: `trigger`, `status`, `failureReason`,
  `attempts`, `createdAt`.
- **Further step:** a generic, table-agnostic change log (e.g. Prisma middleware capturing all
  mutations, or a Postgres trigger) for field-level history and non-domain actions (logins,
  RBAC denials).

### Cloudflare stack (⚠️ documented)
Not deployed here. Hono was chosen partly because it runs natively on **Cloudflare Workers**, so
the path is short:
- **API** → deploy `backend` as a **Cloudflare Worker** (swap `@hono/node-server` for the Workers
  adapter; use a Workers-compatible Postgres driver / Prisma Accelerate or Supabase over HTTP).
- **Frontend** → deploy `frontend` (Next.js) to **Cloudflare Pages**.
- **Edge** → Cloudflare in front for CDN/DNS/WAF; secrets via Workers env vars.

---

## 🌐 API

| Method & Path | Role | Description |
|---|---|---|
| `POST /api/auth/login` | public | Login → JWT (cookie + body) |
| `GET /api/auth/me` | any | Current user |
| `GET /api/accounts` | Admin/Manager/User | List (role-scoped) |
| `GET /api/accounts/:id` | Admin/Manager/User | Detail + events + auctions |
| `POST /api/events` | Admin/Manager/User | Create an event |
| `POST /api/accounts/:id/auctions` | Admin/Manager | Open an auction |
| `GET /api/auctions` | any | List (banker = masked + eligibility-filtered) |
| `GET /api/auctions/:id` | any | Auction detail (role-aware) |
| `POST /api/auctions/:id/offers` | Banker | Submit / update an offer |
| `POST /api/auctions/:id/close` | Admin/Manager | Close → pick winner |
| `GET /api/analytics/summary` | Admin | System summary |

Every endpoint: zod validation → RBAC guard → service. Errors are normalized by `app.onError`
into `{ error, code }`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and a PostgreSQL database (this project used a free Supabase project).

### Backend
```bash
cd backend
npm install
cp .env.example .env          # then fill DATABASE_URL / DIRECT_URL / JWT_SECRET
npm run db:migrate            # apply Prisma migrations
npm run db:seed               # seed users, banks, accounts
npm run dev                   # http://localhost:4000
```

> **Supabase + Prisma:** set `DATABASE_URL` to the **transaction pooler** (port 6543,
> `?pgbouncer=true`) and `DIRECT_URL` to the **direct** connection (port 5432) used for
> migrations. Both are in `.env.example`.

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev                         # http://localhost:3000
```

### Seeded accounts (password for all: `Password123!`)
| Email | Role |
|---|---|
| `admin@creditly.dev` | ADMIN |
| `manager@creditly.dev` | MANAGER |
| `user@creditly.dev` | USER |
| `banker.alpha@creditly.dev` | BANKER (Bank Alpha — eligible for all) |
| `banker.beta@creditly.dev` | BANKER (Bank Beta — high-value accounts only) |

---

## 🧪 Testing

Two suites:

```bash
cd backend
npm test               # 21 unit tests — fast, no DB (repositories spied, logic pure)
npm run test:integration   # 9 API integration tests — real HTTP + JWT, hits the DB
```

### Unit (`npm test`) — 21 tests
1. **RBAC behavior** — bankers blocked from accounts; managers blocked from accounts they don't own.
2. **Banker cannot see PII** — serializer masks name/phone/email and competitor offers.
3. **Best offer selection** — lowest rate; tie → earliest; tie → id (deterministic).
4. **No offers after expiration** — offers past `endsAt` (and on non-OPEN auctions) rejected.
5. **Integration failure handling** — retries exhausted → `SyncLog` FAILED + `failureReason`.
6. **Zod ↔ Prisma enum alignment** — every `EventType` passing edge validation is DB-valid;
   lowercase/unknown rejected; drift guard + `Role` contract (`ADMIN|MANAGER|USER|BANKER`).

### Integration (`npm run test:integration`) — 9 tests
Real API requests via Hono's `app.request()` with **signed role JWTs**, flowing through the full
pipeline (auth → RBAC → validation → controller → service → serializer) against the database.
Fixtures are namespaced `itest-` and cleaned up automatically (seed data untouched); they use the
**direct** DB connection (`DIRECT_URL`). Requires a configured `.env` + migrated DB.
- **401** for unauthenticated; **403** for a banker listing accounts; **403** for a manager reading
  another manager's account.
- **Data masking** — banker `GET /auctions/:id` returns no `customerName/phone/email`; exposes
  `myOffers` only, never a competitor `offers` list.
- **Scoped access** — Manager A sees account A and not B; Manager B sees B and not A.
- **RBAC × business logic** — banker offer on an expired auction → `400 AUCTION_EXPIRED`; on a
  closed auction → `400 AUCTION_NOT_OPEN`.

### ✅ Tests performed — summary

**30 automated tests passing** (21 unit + 9 integration), plus a full manual end-to-end run
against the live database.

| Area | Type | What was verified | Status |
|---|---|---|---|
| RBAC — endpoint guards | unit + integration | unauth → 401; banker → accounts 403; manager → other's account 403 | ✅ |
| RBAC — PII masking | unit + integration | banker `GET /auctions/:id` never returns name/phone/email | ✅ |
| RBAC — scoped access | integration | Manager A sees only A's accounts; Manager B only B's | ✅ |
| Auction — best offer + tie-break | unit | lowest rate; tie → earliest → id (deterministic) | ✅ |
| Auction — expiry / not-open | unit + integration | offers rejected past `endsAt` / on non-OPEN auctions | ✅ |
| Business logic — High Activity | manual e2e | >3 events/24h → `isHighActivity = true` | ✅ |
| Integration — CRM retry/failure | unit | retries exhausted → `SyncLog` FAILED + `failureReason` | ✅ |
| Validation — Zod ↔ Prisma enums | unit | edge-valid input is always DB-valid; drift guard | ✅ |
| Full auction flow | manual e2e | open → 2 offers → close → lowest wins, account `WON`, CRM synced | ✅ |
| Type safety | `tsc --noEmit` | strict TypeScript, no errors | ✅ |

> Manual end-to-end was run against the seeded Supabase database across all five roles —
> confirming login, the RBAC matrix, PII masking, the complete auction lifecycle, and the
> High-Activity rule.

---

## 🖼️ UI Screenshots

| | |
|---|---|
| **Login** (demo accounts) | **Accounts** (admin) |
| ![Login](docs/screenshots/01-login.png) | ![Accounts](docs/screenshots/02-accounts.png) |
| **Account detail** — PII + event timeline + High Activity | **Auctions (Admin)** — full offers + winner |
| ![Account detail](docs/screenshots/03-account-detail.png) | ![Auctions admin](docs/screenshots/04-auctions-admin.png) |

**Auctions (Banker)** — note: no "Accounts" nav, **no customer PII**, "competitors hidden", own offer only:

![Auctions banker](docs/screenshots/05-auctions-banker.png)

---

## 📝 Assumptions & Trade-offs

- **Auth token in body + cookie.** httpOnly cookie is the primary mechanism; the body token
  keeps tests and non-browser clients simple.
- **Single access JWT, no refresh token** (1-day expiry; re-login on expiry). A conscious
  scope decision — the spec requires "Authentication (JWT)" only. Refresh-token rotation +
  server-side revocation would be the production follow-up.
- **Blind auction model** (see above) — confidentiality over live price competition.
- **CRM sync is awaited synchronously** inside services (with retry/backoff) rather than pushed
  to an external broker. In-process keeps it testable without infra; the retry loop is the
  documented place to swap in a real queue.
- **`isHighActivity` is a boolean**, not a multi-level enum — the spec defines only one state
  ("High Activity"), so inventing LOW/MEDIUM with no rules would be misleading.
- **One open auction per account** at a time (guarded on open).
- **Bank eligibility** is modeled simply as `account.amount >= bank.minAmount`.
- **Expiry** is enforced lazily (offers rejected past `endsAt`) plus an explicit close endpoint;
  a scheduled sweeper would be the production addition.
- Analytics summary is **admin-only** (system-wide dashboard).

---

## 📊 Evaluation Map

| Criterion | Where |
|---|---|
| Backend architecture | Clean layering, thin controllers, `app.ts`/services/repositories |
| RBAC | `middlewares/rbac.ts` + `serializers/` PII masking + service-level access checks |
| Business logic | `events/eventDispatcher.ts`, `services/auctionService.ts` |
| Auction module | `services/auctionService.ts` + pure `services/auctionLogic.ts` |
| Integration | `integration/crmService.ts` (retry/backoff + SyncLog) |
| Frontend | `frontend/` (role-based, basic) |
| Tests | `backend/tests/` (16 passing) |
