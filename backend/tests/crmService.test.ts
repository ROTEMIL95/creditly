import { describe, it, expect, vi, afterEach } from 'vitest';
import { SyncTrigger, SyncStatus } from '@prisma/client';
import { crmService } from '../src/integration/crmService.js';
import { createFailingClient } from '../src/integration/crmClient.js';
import { syncLogRepository } from '../src/repositories/syncLogRepository.js';

describe('CRM integration — failure & retry handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries then records a FAILED SyncLog with the failure reason', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = vi.spyOn(syncLogRepository, 'create').mockResolvedValue({} as any);

    const result = await crmService.sync(
      SyncTrigger.STATUS_CHANGED,
      { accountId: 'acc1' },
      { client: createFailingClient('CRM unavailable'), maxRetries: 2, baseDelayMs: 0 },
    );

    expect(result.status).toBe(SyncStatus.FAILED);
    expect(result.attempts).toBe(3); // initial try + 2 retries
    expect(result.failureReason).toContain('CRM unavailable');
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: SyncTrigger.STATUS_CHANGED,
        status: SyncStatus.FAILED,
        failureReason: expect.stringContaining('CRM unavailable'),
        attempts: 3,
      }),
    );
  });

  it('records SUCCESS when the CRM call succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = vi.spyOn(syncLogRepository, 'create').mockResolvedValue({} as any);

    const result = await crmService.sync(
      SyncTrigger.DOCUMENT_UPLOADED,
      {},
      { client: { async send() {} }, maxRetries: 2, baseDelayMs: 0 },
    );

    expect(result.status).toBe(SyncStatus.SUCCESS);
    expect(result.attempts).toBe(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: SyncStatus.SUCCESS }),
    );
  });
});
