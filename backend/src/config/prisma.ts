import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from './env.js';
import { isEdgeRuntime } from './runtime.js';

// Node: one client for the whole process — connection pooling across requests.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Edge (Workers): I/O objects (DB sockets) cannot be shared across requests, so the client
// must be created per request and kept in request-scoped async context. A global singleton
// would make the 2nd request reuse the 1st request's socket → the worker hangs. Edge entry
// points (see worker.ts) wrap their work in withPrismaScope().
const edgeStore = new AsyncLocalStorage<PrismaClient>();

function buildNodeClient(): PrismaClient {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function buildEdgeClient(): PrismaClient {
  // pg driver adapter over TCP (nodejs_compat). DATABASE_URL → Supabase pooler.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Runs `fn` with a request-scoped Prisma client on edge; a transparent pass-through on Node.
// Edge handlers (fetch/scheduled) MUST wrap their work in this.
export async function withPrismaScope<T>(fn: () => T | Promise<T>): Promise<Awaited<T>> {
  if (!isEdgeRuntime()) return await fn();
  const client = buildEdgeClient();
  try {
    return await edgeStore.run(client, () => Promise.resolve(fn()));
  } finally {
    await client.$disconnect();
  }
}

function getClient(): PrismaClient {
  if (isEdgeRuntime()) {
    const client = edgeStore.getStore();
    if (!client) {
      throw new Error('No request-scoped Prisma client — wrap edge handlers in withPrismaScope().');
    }
    return client;
  }
  if (!globalForPrisma.prisma) globalForPrisma.prisma = buildNodeClient();
  return globalForPrisma.prisma;
}

// Lazy Proxy: resolves the active client (request-scoped on edge, singleton on Node) on each
// property access, keeping every existing `prisma.model.method(...)` call site unchanged.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get: (_t, prop) => {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
