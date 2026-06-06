import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventType } from '@prisma/client';
import { eventDispatcher } from '../src/events/eventDispatcher.js';
import { eventRepository } from '../src/repositories/eventRepository.js';
import { accountRepository } from '../src/repositories/accountRepository.js';
import { auditService } from '../src/services/auditService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyMock = () => undefined as any;

describe('Business logic — High Activity rule', () => {
  afterEach(() => vi.restoreAllMocks());

  // Mandatory rule: more than 3 events on an account within 24h flips it to High Activity.
  // The eventDispatcher applies this on every recorded event.
  it('flags an account as High Activity after >3 events in 24h', async () => {
    vi.spyOn(eventRepository, 'create').mockResolvedValue(anyMock());
    vi.spyOn(eventRepository, 'countSince').mockResolvedValue(4); // 4 > 3 threshold
    const update = vi.spyOn(accountRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(auditService, 'record').mockResolvedValue(undefined); // keep the audit hook off the DB

    await eventDispatcher.record({ accountId: 'acc1', type: EventType.NOTE_ADDED, createdById: 'u1' });

    expect(update).toHaveBeenCalledWith('acc1', { isHighActivity: true });
  });
});
