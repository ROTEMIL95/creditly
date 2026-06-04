import { describe, it, expect, vi, afterEach } from 'vitest';
import { Role, AuctionStatus } from '@prisma/client';
import { auctionService } from '../src/services/auctionService.js';
import { auctionRepository } from '../src/repositories/auctionRepository.js';
import { offerRepository } from '../src/repositories/offerRepository.js';
import { AppError } from '../src/lib/errors.js';
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

describe('Auction expiry — no offers allowed after expiration', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects an offer after the auction has expired', async () => {
    vi.spyOn(auctionRepository, 'findById').mockResolvedValue(
      auction({ endsAt: new Date(Date.now() - 1000) }), // already expired
    );
    const upsertSpy = vi.spyOn(offerRepository, 'upsert');

    await expect(auctionService.submitOffer(banker, 'auc1', 5)).rejects.toMatchObject({
      code: 'AUCTION_EXPIRED',
    });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('rejects an offer when the auction is not OPEN', async () => {
    vi.spyOn(auctionRepository, 'findById').mockResolvedValue(
      auction({ status: AuctionStatus.WON }),
    );
    await expect(auctionService.submitOffer(banker, 'auc1', 5)).rejects.toMatchObject({
      code: 'AUCTION_NOT_OPEN',
    });
  });

  it('rejects offers from non-bankers', async () => {
    const manager: AuthUser = { id: 'mgr1', role: Role.MANAGER, bankId: null };
    await expect(auctionService.submitOffer(manager, 'auc1', 5)).rejects.toBeInstanceOf(AppError);
  });
});
