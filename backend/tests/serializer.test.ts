import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { serializeAuction } from '../src/serializers/index.js';

// Minimal auction graph with PII on the account and offers from two different banks.
const auction = {
  id: 'auc1',
  status: 'OPEN',
  accountId: 'acc1',
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2026-01-04T00:00:00Z'),
  winningOfferId: null,
  openedById: 'mgr1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  account: {
    id: 'acc1',
    customerName: 'Jane Smith',
    phone: '+1-555-0200',
    email: 'jane.smith@example.com',
    status: 'IN_AUCTION',
    amount: 250000,
    managerId: 'mgr1',
    isHighActivity: false,
    lastActivity: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  offers: [
    { id: 'o1', auctionId: 'auc1', bankId: 'bankA', bankerId: 'b1', interestRate: 5.0, isWinner: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'o2', auctionId: 'auc1', bankId: 'bankB', bankerId: 'b2', interestRate: 4.0, isWinner: false, createdAt: new Date(), updatedAt: new Date() },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('Serializer — banker PII masking (Blind model)', () => {
  // The role-aware serializer guarantees a banker NEVER receives customer PII
  // (name/phone/email) and sees only their own offer — never the competitor list.
  it('hides PII and competitor offers from a banker', () => {
    const view = serializeAuction(auction, { role: Role.BANKER, bankId: 'bankA' });
    const json = JSON.stringify(view);

    expect(json).not.toContain('Jane Smith');
    expect(json).not.toContain('+1-555-0200');
    expect(json).not.toContain('jane.smith@example.com');
    expect((view.account as Record<string, unknown>).customerName).toBeUndefined();
    // Non-PII summary (amount/status) is allowed for eligibility context.
    expect(view.account).toMatchObject({ id: 'acc1', status: 'IN_AUCTION', amount: 250000 });
    // Blind: only the banker's own offer, never the full competitor list.
    expect(view.myOffers).toHaveLength(1);
    expect(view.myOffers?.[0]?.bankId).toBe('bankA');
    expect((view as Record<string, unknown>).offers).toBeUndefined();
  });
});
