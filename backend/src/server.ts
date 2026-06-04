import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Creditly API listening on http://localhost:${info.port}`);
});
