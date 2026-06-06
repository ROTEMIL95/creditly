import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuctionStatus, SyncTrigger } from '@prisma/client';
import { auctionService } from '../src/services/auctionService.js';
import { auctionRepository } from '../src/repositories/auctionRepository.js';
import { offerRepository } from '../src/repositories/offerRepository.js';
import { accountRepository } from '../src/repositories/accountRepository.js';
import { eventDispatcher } from '../src/events/eventDispatcher.js';
import { crmService } from '../src/integration/crmService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyMock = () => undefined as any;

describe('Auction — close selects the winning (lowest) offer', () => {
  afterEach(() => vi.restoreAllMocks());

  // Closing an auction that has offers: the lowest-rate offer is marked winner, the
  // account moves to WON, and the WINNING_OFFER_SELECTED CRM sync fires.
  it('marks the lowest offer winner, sets the account WON, and syncs CRM', async () => {
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

    // sweepExpiredAuctions runs the shared finalizeAuction path used by manual close too.
    const result = await auctionService.sweepExpiredAuctions();

    expect(result).toEqual({ swept: 1, failed: 0 });
    expect(markWinner).toHaveBeenCalledWith('o1');
    expect(auctionUpdate).toHaveBeenCalledWith('a2', expect.objectContaining({ status: AuctionStatus.WON }));
    expect(sync).toHaveBeenCalledWith(
      SyncTrigger.WINNING_OFFER_SELECTED,
      expect.objectContaining({ winningOfferId: 'o1' }),
    );
  });
});
