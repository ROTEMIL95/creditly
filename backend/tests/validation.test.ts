import { describe, it, expect } from 'vitest';
import { EventType } from '@prisma/client';
import { createEventSchema } from '../src/routes/schemas.js';

describe('Validation — Zod ↔ Prisma enum alignment (edge layer)', () => {
  // Edge validation must accept EXACTLY the Prisma EventType set in UPPERCASE and reject
  // lowercase/unknown values — so anything that passes the edge is always DB-valid (no drift).
  it('accepts exactly the EventType set (UPPERCASE) and rejects drift', () => {
    const all = Object.values(EventType);

    const accepted = all.filter((type) => createEventSchema.safeParse({ accountId: 'acc1', type }).success);
    expect(new Set(accepted)).toEqual(new Set(all)); // every value accepted, nothing missing/extra

    for (const type of all) {
      expect(createEventSchema.safeParse({ accountId: 'acc1', type: type.toLowerCase() }).success).toBe(false);
    }
    expect(createEventSchema.safeParse({ accountId: 'acc1', type: 'FOO' }).success).toBe(false);
  });
});
