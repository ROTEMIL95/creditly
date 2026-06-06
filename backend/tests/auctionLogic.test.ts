import { describe, it, expect } from 'vitest';
import { selectWinningOffer } from '../src/services/auctionLogic.js';

const offer = (id: string, interestRate: number, createdAt: string) => ({
  id,
  interestRate,
  createdAt: new Date(createdAt),
});

describe('Auction — best offer selection (pure domain logic)', () => {
  // Winner = lowest interest rate. Ties resolve deterministically: earliest submission,
  // then lowest id — so equal/simultaneous bids still produce a stable, reproducible winner.
  it('selects the lowest rate, breaking ties by earliest time then lowest id', () => {
    // Lowest rate wins outright.
    expect(
      selectWinningOffer([
        offer('a', 5.5, '2026-01-01T10:00:00Z'),
        offer('b', 4.2, '2026-01-01T11:00:00Z'),
        offer('c', 6.0, '2026-01-01T09:00:00Z'),
      ])?.id,
    ).toBe('b');

    // Equal rate → earliest createdAt wins.
    expect(
      selectWinningOffer([
        offer('late', 4.0, '2026-01-01T12:00:00Z'),
        offer('early', 4.0, '2026-01-01T08:00:00Z'),
      ])?.id,
    ).toBe('early');

    // Equal rate AND identical time → lowest id wins (final deterministic tie-break).
    const sameTime = '2026-01-01T08:00:00Z';
    expect(selectWinningOffer([offer('zzz', 4.0, sameTime), offer('aaa', 4.0, sameTime)])?.id).toBe('aaa');
  });
});
