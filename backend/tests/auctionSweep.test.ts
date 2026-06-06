import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuctionStatus, EventType, SyncTrigger } from '@prisma/client';
import { auctionService } from '../src/services/auctionService.js';
import { auctionRepository } from '../src/repositories/auctionRepository.js';
import { offerRepository } from '../src/repositories/offerRepository.js';
import { accountRepository } from '../src/repositories/accountRepository.js';
import { eventDispatcher } from '../src/events/eventDispatcher.js';
import { crmService } from '../src/integration/crmService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyMock = () => undefined as any;

describe('auctionService.sweepExpiredAuctions — Cron expiry sweeper', () => {
  afterEach(() => vi.restoreAllMocks());

  it('closes an expired auction with no offers as EXPIRED', async () => {
    vi.spyOn(auctionRepository, 'findExpiredOpen').mockResolvedValue([
      { id: 'a1', accountId: 'acc1', openedById: 'mgr1' },
    ]);
    vi.spyOn(offerRepository, 'listByAuction').mockResolvedValue([]);
    const auctionUpdate = vi.spyOn(auctionRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(accountRepository, 'update').mockResolvedValue(anyMock());
    const record = vi.spyOn(eventDispatcher, 'record').mockResolvedValue(anyMock());

    const result = await auctionService.sweepExpiredAuctions();

    expect(result).toEqual({ swept: 1, failed: 0 });
    expect(auctionUpdate).toHaveBeenCalledWith('a1', { status: AuctionStatus.EXPIRED });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.AUCTION_CLOSED, createdById: 'mgr1' }),
    );
  });

  it('closes an expired auction with offers as WON and fires the CRM sync', async () => {
    vi.spyOn(auctionRepository, 'findExpiredOpen').mockResolvedValue([
      { id: 'a2', accountId: 'acc2', openedById: 'mgr2' },
    ]);
    vi.spyOn(offerRepository, 'listByAuction').mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: 'o1', interestRate: 5, createdAt: new Date() } as any,
    ]);
    const markWinner = vi.spyOn(offerRepository, 'markWinner').mockResolvedValue(anyMock());
    const auctionUpdate = vi.spyOn(auctionRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(accountRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(eventDispatcher, 'record').mockResolvedValue(anyMock());
    const sync = vi.spyOn(crmService, 'sync').mockResolvedValue(anyMock());

    const result = await auctionService.sweepExpiredAuctions();

    expect(result).toEqual({ swept: 1, failed: 0 });
    expect(markWinner).toHaveBeenCalledWith('o1');
    expect(auctionUpdate).toHaveBeenCalledWith(
      'a2',
      expect.objectContaining({ status: AuctionStatus.WON }),
    );
    expect(sync).toHaveBeenCalledWith(
      SyncTrigger.WINNING_OFFER_SELECTED,
      expect.objectContaining({ auctionId: 'a2', winningOfferId: 'o1' }),
    );
  });

  it('continues the batch when one auction fails to finalize', async () => {
    vi.spyOn(auctionRepository, 'findExpiredOpen').mockResolvedValue([
      { id: 'bad', accountId: 'accX', openedById: 'mgrX' },
      { id: 'good', accountId: 'accY', openedById: 'mgrY' },
    ]);
    vi.spyOn(offerRepository, 'listByAuction').mockImplementation(async (auctionId: string) => {
      if (auctionId === 'bad') throw new Error('db blip');
      return [];
    });
    vi.spyOn(auctionRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(accountRepository, 'update').mockResolvedValue(anyMock());
    vi.spyOn(eventDispatcher, 'record').mockResolvedValue(anyMock());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await auctionService.sweepExpiredAuctions();

    expect(result).toEqual({ swept: 1, failed: 1 });
  });
});
