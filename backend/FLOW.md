# System Flow — Creditly (Node + Cloudflare Workers)

How a request flows through the system as it stands now. Mermaid diagrams render on
GitHub / in the VSCode preview. File references point to the real code.

## 1. High level — two entry points, one core

Both runtimes are thin platform adapters over the **same** Hono app; the business layers
never know which runtime they run on.

```mermaid
flowchart TD
    subgraph Entry["Platform adapters (thin)"]
      N["Node: server.ts<br/>@hono/node-server"]
      W["Edge: worker.ts<br/>fetch + scheduled"]
    end
    N --> APP["createApp() — app.ts<br/>logger · cors · /health · /api · onError"]
    W --> APP
    APP --> C["Controllers — HTTP only"]
    C --> S["Services — business logic"]
    S --> R["Repositories — Prisma only"]
    R --> P[("prisma Proxy — config/prisma.ts")]
    P --> DB[("PostgreSQL / Supabase<br/>via @prisma/adapter-pg")]
    S --> EV["events/eventDispatcher"]
    S --> CRM["integration/crmService"]
    EV --> R
    CRM --> SL[("SyncLog")]
```

## 2. Request lifecycle (with the edge-specific steps)

`env` and `prisma` are **lazy Proxies** resolved during the request — so the same code runs
on Node and edge. On edge the DB client is created **per request** (sockets can't be shared
across requests in Workers).

```mermaid
sequenceDiagram
    participant Cl as Client
    participant Wk as worker.ts (edge)
    participant App as Hono app
    participant MW as auth + rbac + zod
    participant Ctl as Controller
    participant Svc as Service
    participant Repo as Repository
    participant DB as Postgres (Supabase)

    Cl->>Wk: HTTP request
    Wk->>Wk: setBindings(env)  (runtime.ts)
    Wk->>Wk: withPrismaScope() opens request-scoped client (ALS)
    Wk->>App: app.fetch(req)
    App->>MW: logger → cors → requireAuth (JWT cookie) → requireRole → zValidator
    MW->>Ctl: validated request
    Ctl->>Svc: call service
    Svc->>Repo: query
    Repo->>DB: prisma (adapter-pg, TCP)
    DB-->>Cl: JSON response
    Wk->>Wk: withPrismaScope finally → client.$disconnect()
```

## 3. Login flow

```mermaid
flowchart LR
    A["POST /api/auth/login"] --> B["zValidator(loginSchema)"]
    B --> C["authController.login"]
    C --> D["authService.login"]
    D --> E["userRepository.findByEmail → Postgres"]
    D --> F["verifyPassword — PBKDF2 / Web Crypto"]
    D --> G["signJwt"]
    G --> H["setCookie httpOnly+Secure → 200 {user, token}"]
    F -. mismatch .-> X["401"]
```

PBKDF2 (not bcrypt) so it fits the Workers free-plan CPU budget — see [CLOUDFLARE.md](CLOUDFLARE.md).

## 4. Auction lifecycle + the Cron sweep

Manual close and the cron sweep call the **same** `finalizeAuction` — the cron handler holds
no business logic, it's just another caller.

```mermaid
flowchart TD
    O["POST /accounts/:id/auctions<br/>openAuction → OPEN, endsAt=+3d, event AUCTION_OPENED"]
    SUB["POST /auctions/:id/offers<br/>submitOffer (Blind, eligibility) → event OFFER_SUBMITTED"]
    O --> SUB
    SUB --> CLOSE{Close}
    CLOSE -->|"manual: POST .../close"| FIN
    CLOSE -->|"cron */5 * * * *<br/>worker.scheduled → sweepExpiredAuctions → findExpiredOpen"| FIN
    FIN["finalizeAuction()"]
    FIN --> WIN["selectWinningOffer (lowest rate, deterministic tie-break)"]
    WIN -->|winner| W1["auction WON · account WON · event AUCTION_CLOSED<br/>+ crmService.sync(WINNING_OFFER_SELECTED)"]
    WIN -->|no offers| W2["auction EXPIRED · account ACTIVE · event AUCTION_CLOSED"]
```

## 5. Events + CRM integration (the two layers "behind" services)

```mermaid
flowchart TD
    REC["eventDispatcher.record(event)"]
    REC --> CR["eventRepository.create"]
    REC --> RULES["applyBusinessRules"]
    RULES --> HA[">3 events / 24h → account.isHighActivity = true"]
    RULES --> DOC["DOCUMENT_UPLOADED → lastActivity + CRM sync"]
    REC --> TRIG{"event maps to a CRM trigger?"}
    TRIG -->|yes| SYNC["crmService.sync(trigger, payload)"]
    SYNC --> RETRY["retry + exponential backoff"]
    RETRY --> OK["success → SyncLog SUCCESS"]
    RETRY --> FAIL["exhausted → SyncLog FAILED (reason, attempts)"]
```

## RBAC / PII enforcement (server-side, always)

Role-aware serializers ([serializers/index.ts](src/serializers/index.ts)) guarantee a
**BANKER never receives customer PII** (name/phone/email). Enforced in the shared app, so it
holds identically on Node and on the edge.

## Live

Deployed (Workers free plan): `https://creditly-api.rotem-creditly.workers.dev` — see
[CLOUDFLARE.md](CLOUDFLARE.md) for what it took to make the edge path real.
