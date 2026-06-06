// Runtime / platform adapter — the single place that knows *where* configuration
// comes from. On Node, env vars live on `process.env` (loaded from .env). On an edge
// runtime (Cloudflare Workers) there is no `process`; vars arrive per-request as
// bindings and must be injected via `setBindings()` before any config is read.
//
// This keeps the rest of the app (services/repositories/controllers) runtime-agnostic:
// they import `{ env }` and `{ prisma }` exactly as before — only the *source* changes.

type Bindings = Record<string, unknown>;

let injected: Bindings | undefined;

// True only when running inside the Cloudflare Workers runtime. `navigator.userAgent`
// is the documented, stable signal (with nodejs_compat `process` may exist too, so we
// cannot rely on its absence).
export function isEdgeRuntime(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === 'Cloudflare-Workers';
}

// Called by the Workers entry (src/worker.ts) at the start of every fetch/scheduled
// invocation, before the request is handled. Idempotent and cheap.
export function setBindings(bindings: Bindings): void {
  injected = bindings;
}

// The active configuration source. Injected bindings win (edge); otherwise fall back
// to process.env (Node). Throws a clear error if neither is available — which would
// only happen on edge if config is read before setBindings(), i.e. a wiring bug.
export function getBindings(): Bindings {
  if (injected) return injected;
  const proc = (globalThis as { process?: { env?: Bindings } }).process;
  if (proc?.env) return proc.env;
  throw new Error(
    'Runtime bindings not initialised — call setBindings(env) before reading config on edge.',
  );
}
