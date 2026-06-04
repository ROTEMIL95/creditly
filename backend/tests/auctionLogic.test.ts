import { describe, it, expect } from 'vitest';
import { selectWinningOffer } from '../src/services/auctionLogic.js';

const offer = (id: string, interestRate: number, createdAt: string) => ({
  id,
  interestRate,
  createdAt: new Date(createdAt),
});

describe('selectWinningOffer (best offer = lowest interest rate)', () => {
  it('returns null when there are no offers', () => {
    expect(selectWinningOffer([])).toBeNull();
  });

  it('selects the lowest interest rate', () => {
    const winner = selectWinningOffer([
      offer('a', 5.5, '2026-01-01T10:00:00.000Z'),
      offer('b', 4.2, '2026-01-01T11:00:00.000Z'),
      offer('c', 6.0, '2026-01-01T09:00:00.000Z'),
    ]);
    expect(winner?.id).toBe('b');
  });

  it('breaks a rate tie by earliest submission', () => {
    const winner = selectWinningOffer([
      offer('late', 4.0, '2026-01-01T12:00:00.000Z'),
      offer('early', 4.0, '2026-01-01T08:00:00.000Z'),
    ]);
    expect(winner?.id).toBe('early');
  });

  it('breaks a rate+time tie deterministically by id', () => {
    const sameTime = '2026-01-01T08:00:00.000Z';
    const winner = selectWinningOffer([
      offer('zzz', 4.0, sameTime),
      offer('aaa', 4.0, sameTime),
    ]);
    expect(winner?.id).toBe('aaa');
  });
});
