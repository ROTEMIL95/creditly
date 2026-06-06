import type { Context } from 'hono';
import { auditService } from '../services/auditService.js';
import type { AppEnv } from '../types/index.js';

export const auditController = {
  // Admin-only: the unified audit timeline (already shaped by the service).
  async list(c: Context<AppEnv>) {
    return c.json({ audit: await auditService.list() });
  },
};
