import { z } from 'zod';
import { getBindings, isEdgeRuntime } from './runtime.js';

// Node/test only: hydrate process.env from a local .env file. On edge runtimes there is
// no filesystem and config arrives via bindings (see runtime.ts), so we skip dotenv there.
if (!isEdgeRuntime()) {
  await import('dotenv/config');
}

// Validate environment — fail fast with a clear message.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  CRM_FAIL_RATE: z.coerce.number().min(0).max(1).default(0),
  CRM_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  CRM_RETRY_BASE_MS: z.coerce.number().int().min(0).default(100),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function resolve(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(getBindings());
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}

// Lazy, runtime-agnostic accessor. Backed by a Proxy so every existing `env.X` call site
// keeps working unchanged, while resolution is deferred to first property read. On edge
// that read happens mid-request — after setBindings() has injected the bindings.
export const env: Env = new Proxy({} as Env, {
  get: (_t, prop) => resolve()[prop as keyof Env],
  has: (_t, prop) => prop in resolve(),
  ownKeys: () => Reflect.ownKeys(resolve() as object),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
