import { describe, it, expect } from 'vitest';
import { EventType, Role } from '@prisma/client';
import { createEventSchema } from '../src/routes/schemas.js';

// Guards that the edge Zod validation and the Prisma DB enums stay in lock-step.
// If they drift, input could pass validation and then fail at the database layer.
describe('Zod ↔ Prisma enum alignment', () => {
  const allEventTypes = Object.values(EventType);

  it('createEventSchema accepts EVERY Prisma EventType value', () => {
    for (const type of allEventTypes) {
      const res = createEventSchema.safeParse({ accountId: 'acc1', type });
      expect(res.success, `expected ${type} to be accepted`).toBe(true);
    }
  });

  it('rejects lowercase event types (UPPERCASE API contract)', () => {
    for (const type of allEventTypes) {
      const res = createEventSchema.safeParse({ accountId: 'acc1', type: type.toLowerCase() });
      expect(res.success, `expected ${type.toLowerCase()} to be rejected`).toBe(false);
    }
  });

  it('rejects unknown event types', () => {
    expect(createEventSchema.safeParse({ accountId: 'acc1', type: 'FOO' }).success).toBe(false);
    expect(createEventSchema.safeParse({ accountId: 'acc1', type: '' }).success).toBe(false);
  });

  it('drift guard: the set the schema accepts equals Object.values(EventType) exactly', () => {
    // If someone later replaces z.nativeEnum(EventType) with a hand-written z.enum([...]),
    // a missing or extra value here will fail this test.
    const accepted = allEventTypes.filter(
      (type) => createEventSchema.safeParse({ accountId: 'acc1', type }).success,
    );
    expect(new Set(accepted)).toEqual(new Set(allEventTypes));
    expect(accepted).toHaveLength(allEventTypes.length);
  });

  it('Role contract guard: exactly ADMIN | MANAGER | USER | BANKER (UPPERCASE)', () => {
    // These are the values requireRole() and the JWT payload rely on.
    expect(new Set(Object.values(Role))).toEqual(new Set(['ADMIN', 'MANAGER', 'USER', 'BANKER']));
  });
});
