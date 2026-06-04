import type { Context } from 'hono';
import { analyticsService } from '../services/analyticsService.js';
import type { AppEnv } from '../types/index.js';

export const analyticsController = {
  async summary(c: Context<AppEnv>) {
    return c.json({ summary: await analyticsService.summary() });
  },
};
