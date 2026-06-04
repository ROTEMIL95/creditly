import type { Context } from 'hono';
import { EventType, Prisma } from '@prisma/client';
import { eventService } from '../services/eventService.js';
import { serializeEvent } from '../serializers/index.js';
import type { AppEnv } from '../types/index.js';

export const eventController = {
  async create(c: Context<AppEnv>) {
    const user = c.get('user');
    const body = await c.req.json<{ accountId: string; type: EventType; payload?: unknown }>();

    const event = await eventService.createEvent(user, {
      accountId: body.accountId,
      type: body.type,
      payload: body.payload as Prisma.InputJsonValue | undefined,
    });

    return c.json({ event: serializeEvent(event) }, 201);
  },
};
