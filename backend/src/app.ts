import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ZodError } from 'zod';
import { AppError } from './lib/errors.js';
import { buildRoutes } from './routes/index.js';
import type { AppEnv } from './types/index.js';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*', // dev-friendly; tighten for production
      credentials: true,
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/api', buildRoutes());

  // Central error handler → consistent JSON { error, code }.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status);
    }
    if (err instanceof ZodError) {
      return c.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: err.issues }, 400);
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  });

  app.notFound((c) => c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404));

  return app;
}
