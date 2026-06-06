# Running the backend on Cloudflare Workers (experiment)

This is a **learning/experiment** track on the `experiment/cloudflare-workers` branch. The
Node path (`npm run dev` / `npm start`) is unchanged and remains the default — this only
**adds** an edge deployment target.

## Why it's almost free here
Hono is multi-runtime, and Clean Architecture keeps `controllers → services → repositories`
free of any runtime coupling. All runtime-specific concerns live in three small modules:

| Concern | Module | Node | Workers |
| --- | --- | --- | --- |
| Where config comes from | `src/config/runtime.ts` | `process.env` (from `.env`) | `c.env` bindings, injected via `setBindings()` |
| Env access | `src/config/env.ts` | lazy Proxy → same | lazy Proxy → same |
| DB client | `src/config/prisma.ts` | library engine, process-wide singleton | `@prisma/adapter-pg` over TCP (`nodejs_compat`), **per-request** client |
| Entry point | `src/server.ts` (Node) | `@hono/node-server` | `src/worker.ts` (`fetch` + `scheduled`) |

Everything else imports `{ env }` / `{ prisma }` exactly as before.

### Per-request DB client on edge (important)
Workers forbid sharing an I/O object (a DB socket) across requests — a global Prisma
singleton makes the 2nd request reuse the 1st request's socket and the worker **hangs**
("code had hung and would never generate a response"). So on edge the client is created
**per request** and stored in `AsyncLocalStorage`; the entry points wrap their work in
`withPrismaScope()`. On Node, the original process-wide singleton is unchanged. The
`prisma` Proxy resolves to the right one transparently, so repositories never change.
(Production upgrade: Cloudflare Hyperdrive pools connections so each request is cheap.)

## What's new on the edge
- **`src/worker.ts`** — thin platform adapter: `fetch` (HTTP → same Hono app) and
  `scheduled` (Cron → `auctionService.sweepExpiredAuctions()`). No business logic.
- **Cron auto-close** — `auctionService.sweepExpiredAuctions()` finalizes every `OPEN`
  auction past `endsAt`, reusing the existing `finalizeAuction` (winner → `WON` + CRM sync,
  or no offers → `EXPIRED`). This is the one genuinely Workers-native addition; manual close
  still works too.

## Run it locally
```bash
cd backend
cp .dev.vars.example .dev.vars      # then fill real values (use the Supabase 6543 pooler)
npm run db:generate                 # generates the Prisma client (driverAdapters enabled)
npm run cf:dev                      # = wrangler dev  → http://localhost:8787
```
Test the cron without waiting 3 days:
```bash
npx wrangler dev --test-scheduled
# then in another shell:
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

## Password hashing: PBKDF2, not bcrypt
`src/lib/password.ts` uses **PBKDF2 via Web Crypto** (100k iterations, SHA-256), not bcrypt.
Reason: `bcryptjs` is pure-JS and CPU-heavy — on the Workers **free** plan it blows the
per-request CPU budget and login fails ("exceeded CPU"). WebCrypto PBKDF2 is native and fits.
The stored format is self-describing (`pbkdf2$<iters>$<salt>$<hash>`), and it runs identically
on Node. Changing the algorithm means existing hashes must be re-generated — `npm run db:seed`
re-hashes all seeded users (the upserts set `passwordHash` on update).

## Deploy to a real Cloudflare account
```bash
cd backend
export CLOUDFLARE_API_TOKEN=...           # "Edit Cloudflare Workers" token
npx wrangler deploy                       # creates the worker (needs a workers.dev subdomain)
echo "$DATABASE_URL" | npx wrangler secret put DATABASE_URL
echo "$JWT_SECRET"   | npx wrangler secret put JWT_SECRET
```
Gotcha: a brand-new `*.workers.dev` subdomain takes ~1-3 min for its TLS cert to provision —
until then HTTPS handshakes fail. Non-secret config lives in `[vars]` in `wrangler.toml`.

## Verified
- `npm run build` (tsc) — clean
- `npm test` — 24/24 pass (Node path intact + `tests/auctionSweep.test.ts`)
- **Live deploy** → `https://creditly-api.rotem-creditly.workers.dev` on the Workers free plan:
  `/health` 200; login (PBKDF2 + Supabase from the edge) 200 in ~0.9s with no CPU error;
  admin `/api/accounts` returns DB rows; banker `/api/auctions` returns no PII; cron `*/5 * * * *`
  registered.
