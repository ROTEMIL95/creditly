import { describe, it, expect, vi, afterEach } from 'vitest';
import { Role, AuctionStatus } from '@prisma/client';
import { auctionService } from '../src/services/auctionService.js';
import { auctionRepository } from '../src/repositories/auctionRepository.js';
import { offerRepository } from '../src/repositories/offerRepository.js';
import type { AuthUser } from '../src/types/index.js';

const banker: AuthUser = { id: 'b1', role: Role.BANKER, bankId: 'bankA' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auction = (overrides: Record<string, unknown>): any => ({
  id: 'auc1',
  status: AuctionStatus.OPEN,
  accountId: 'acc1',
  endsAt: new Date(Date.now() + 60_000), // not expired by default
  account: { id: 'acc1', amount: 1000 },
  offers: [],
  ...overrides,
});

describe('Auction — no offers after expiry / on a non-OPEN auction', () => {
  afterEach(() => vi.restoreAllMocks());

  // Domain rule: offers are rejected once the auction has passed endsAt, and on any
  // auction that is not OPEN — and no offer is persisted in either case.
  it('rejects offers on expired and non-OPEN auctions', async () => {
    const upsert = vi.spyOn(offerRepository, 'upsert');
    const findById = vi.spyOn(auctionRepository, 'findById');

    findById.mockResolvedValue(auction({ endsAt: new Date(Date.now() - 1000) })); // already expired
    await expect(auctionService.submitOffer(banker, 'auc1', 5)).rejects.toMatchObject({ code: 'AUCTION_EXPIRED' });

    findById.mockResolvedValue(auction({ status: AuctionStatus.WON })); // not OPEN
    await expect(auctionService.submitOffer(banker, 'auc1', 5)).rejects.toMatchObject({ code: 'AUCTION_NOT_OPEN' });

    expect(upsert).not.toHaveBeenCalled();
  });
});
