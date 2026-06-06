// Role-aware serializers. These are the single source of truth for what each role
// is allowed to SEE. A BANKER must NEVER receive customer PII (name/phone/email)
// or other banks' offers — that rule is enforced here, not in controllers.

import { Role } from '@prisma/client';
import type {
  Account,
  AuctionOpportunity,
  BankOffer,
  Event,
  Prisma,
} from '@prisma/client';

const decimal = (v: Prisma.Decimal | number | string): number => Number(v);

// ---- Account ---------------------------------------------------------------

export function serializeAccount(account: Account & { manager?: { id: string; name: string } }) {
  return {
    id: account.id,
    customerName: account.customerName,
    phone: account.phone,
    email: account.email,
    status: account.status,
    amount: decimal(account.amount),
    managerId: account.managerId,
    manager: account.manager ? { id: account.manager.id, name: account.manager.name } : undefined,
    isHighActivity: account.isHighActivity,
    lastActivity: account.lastActivity,
    createdAt: account.createdAt,
  };
}

// Non-PII account summary safe to embed in a banker-facing auction.
export function serializeAccountForBanker(account: Pick<Account, 'id' | 'status' | 'amount'>) {
  return {
    id: account.id,
    status: account.status,
    amount: decimal(account.amount),
  };
}

// ---- Offer -----------------------------------------------------------------

export function serializeOffer(offer: BankOffer & { bank?: { id: string; name: string } }) {
  return {
    id: offer.id,
    auctionId: offer.auctionId,
    bankId: offer.bankId,
    bankName: offer.bank?.name,
    bankerId: offer.bankerId,
    interestRate: decimal(offer.interestRate),
    isWinner: offer.isWinner,
    createdAt: offer.createdAt,
  };
}

// ---- Auction ---------------------------------------------------------------

type AuctionWithRelations = AuctionOpportunity & {
  account?: Account;
  offers?: BankOffer[];
};

export function serializeAuction(
  auction: AuctionWithRelations,
  viewer: { role: Role; bankId: string | null },
) {
  const base = {
    id: auction.id,
    status: auction.status,
    accountId: auction.accountId,
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    winningOfferId: auction.winningOfferId,
    createdAt: auction.createdAt,
  };

  if (viewer.role === Role.BANKER) {
    // Blind model: a banker sees only their OWN offer, and never customer PII.
    const ownOffers = (auction.offers ?? []).filter((o) => o.bankId === viewer.bankId);
    return {
      ...base,
      account: auction.account ? serializeAccountForBanker(auction.account) : undefined,
      myOffers: ownOffers.map(serializeOffer),
      offerCount: auction.offers?.length, // count only — no competitor details
    };
  }

  // Admin / Manager / User: full visibility (PII allowed, all offers visible).
  return {
    ...base,
    account: auction.account ? serializeAccount(auction.account) : undefined,
    offers: (auction.offers ?? []).map(serializeOffer),
  };
}

// ---- Event -----------------------------------------------------------------

export function serializeEvent(event: Event) {
  return {
    id: event.id,
    type: event.type,
    accountId: event.accountId,
    payload: event.payload,
    createdById: event.createdById,
    createdAt: event.createdAt,
  };
}
