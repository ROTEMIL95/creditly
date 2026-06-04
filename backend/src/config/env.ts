import 'dotenv/config';
import { z } from 'zod';

// Validate environment at startup — fail fast with a clear message.
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

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
