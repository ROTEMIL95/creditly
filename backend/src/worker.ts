// Cloudflare Workers entry point — a thin platform adapter, mirroring src/server.ts for
// Node. It contains NO business logic: it injects the request bindings, then delegates to
// the same Hono app (HTTP) and the same domain service (cron). Clean Architecture intact —
// the scheduled handler is just another caller of auctionService, like a controller.

import { createApp } from './app.js';
import { setBindings } from './config/runtime.js';
import { withPrismaScope } from './config/prisma.js';
import { auctionService } from './services/auctionService.js';

// Minimal local types — avoids a hard dependency on @cloudflare/workers-types so the Node
// `tsc` build (types: ["node"]) keeps compiling. Request/Response come from @types/node.
type WorkerEnv = Record<string, unknown>;
interface ScheduledController {
  cron: string;
  scheduledTime: number;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const app = createApp();

export default {
  // HTTP: hydrate bindings, open a request-scoped DB client, then hand off to the Hono app.
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    setBindings(env);
    // Cast: Hono's ExecutionContext type carries an extra `props` field; the runtime
    // object only needs waitUntil/passThroughOnException, which our interface declares.
    return withPrismaScope(() => app.fetch(request, env, ctx as Parameters<typeof app.fetch>[2]));
  },

  // Cron Trigger (schedule in wrangler.toml): auto-close auctions past their 3-day deadline.
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    setBindings(env);
    ctx.waitUntil(withPrismaScope(() => auctionService.sweepExpiredAuctions()));
  },
};
