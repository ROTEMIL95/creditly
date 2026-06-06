import { describe, it, expect, vi, afterEach } from 'vitest';
import { auditService } from '../src/services/auditService.js';
import { auditRepository } from '../src/repositories/auditRepository.js';
import { syncLogRepository } from '../src/repositories/syncLogRepository.js';

describe('auditService.list — unified, newest-first audit timeline', () => {
  afterEach(() => vi.restoreAllMocks());

  it('merges AuditLog + SyncLog, normalizes CRM, and sorts newest-first', async () => {
    const older = new Date('2026-06-06T10:00:00.000Z'); // sync
    const newer = new Date('2026-06-06T11:00:00.000Z'); // login

    vi.spyOn(auditRepository, 'list').mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        id: 'a1',
        action: 'LOGIN_SUCCESS',
        actor: { id: 'u1', name: 'Alice Admin', email: 'admin@creditly.dev', role: 'ADMIN' },
        actorEmail: 'admin@creditly.dev',
        actorRole: 'ADMIN',
        entityType: 'SESSION',
        entityId: null,
        metadata: null,
        createdAt: newer,
      },
    ] as any);

    vi.spyOn(syncLogRepository, 'list').mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        id: 's1',
        trigger: 'AUCTION_OPENED',
        status: 'FAILED',
        failureReason: 'CRM down',
        attempts: 3,
        payload: null,
        createdAt: older,
      },
    ] as any);

    const timeline = await auditService.list();

    expect(timeline).toHaveLength(2);
    // Newest first: the login (newer) precedes the CRM sync (older).
    expect(timeline[0]?.id).toBe('a1');
    expect(timeline[0]?.action).toBe('LOGIN_SUCCESS');
    expect(timeline[0]?.actor).toMatchObject({ name: 'Alice Admin', role: 'ADMIN' });
    // CRM sync is normalized into the same shape with status/reason in metadata.
    expect(timeline[1]?.action).toBe('CRM_SYNC');
    expect(timeline[1]?.actor).toBeNull();
    expect(timeline[1]?.metadata).toMatchObject({
      trigger: 'AUCTION_OPENED',
      syncStatus: 'FAILED',
      failureReason: 'CRM down',
      attempts: 3,
    });
  });
});
