import { Role, AuctionStatus, AccountStatus, EventType, SyncTrigger, Prisma } from '@prisma/client';
import { auctionRepository } from '../repositories/auctionRepository.js';
import { offerRepository } from '../repositories/offerRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { bankRepository } from '../repositories/bankRepository.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { eventDispatcher } from '../events/eventDispatcher.js';
import { crmService } from '../integration/crmService.js';
import { accountService } from './accountService.js';
import { selectWinningOffer } from './auctionLogic.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';

const AUCTION_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const isExpired = (endsAt: Date) => Date.now() >= endsAt.getTime();

// ---- Manager / Admin: open an auction ---------------------------------------

async function openAuction(user: AuthUser, accountId: string) {
  // Only managers (of their own accounts) and admins may open auctions.
  if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
    throw new ForbiddenError('Only managers or admins can open auctions');
  }
  await accountService.assertAccess(user, accountId); // manager-owns / admin-any

  const existing = await auctionRepository.findOpenByAccount(accountId);
  if (existing) throw new ConflictError('Account already has an open auction');

  const auction = await auctionRepository.create({
    accountId,
    openedById: user.id,
    status: AuctionStatus.OPEN,
    endsAt: new Date(Date.now() + AUCTION_DURATION_MS),
  });

  await accountRepository.update(accountId, { status: AccountStatus.IN_AUCTION });

  // Records the AUCTION_OPENED event → also fires the CRM AUCTION_OPENED sync.
  await eventDispatcher.record({
    accountId,
    type: EventType.AUCTION_OPENED,
    createdById: user.id,
    payload: { auctionId: auction.id },
  });

  return auctionRepository.findById(auction.id);
}

// ---- Banker: eligibility-filtered listing ----------------------------------

async function bankerEligibilityFloor(bankId: string | null): Promise<number> {
  if (!bankId) return Number.POSITIVE_INFINITY; // banker with no bank sees nothing
  const bank = await bankRepository.findById(bankId);
  return bank ? Number(bank.minAmount) : Number.POSITIVE_INFINITY;
}

async function listAuctions(user: AuthUser) {
  if (user.role === Role.BANKER) {
    const floor = await bankerEligibilityFloor(user.bankId);
    const open = await auctionRepository.list({ status: AuctionStatus.OPEN });
    // Open, not expired, and the account meets this bank's eligibility threshold.
    return open.filter(
      (a) => !isExpired(a.endsAt) && a.account != null && Number(a.account.amount) >= floor,
    );
  }

  if (user.role === Role.ADMIN) return auctionRepository.list();

  if (user.role === Role.MANAGER) {
    const accounts = await accountRepository.list({ managerId: user.id });
    return auctionRepository.list({ accountId: { in: accounts.map((a) => a.id) } });
  }

  // USER: auctions on related accounts.
  const relatedIds = await eventRepository.accountIdsForCreator(user.id);
  return auctionRepository.list({ accountId: { in: relatedIds } });
}

async function getAuction(user: AuthUser, auctionId: string) {
  const auction = await auctionRepository.findById(auctionId);
  if (!auction) throw new NotFoundError('Auction not found');

  if (user.role === Role.BANKER) {
    // A banker may only view an open, non-expired, bank-eligible auction.
    const floor = await bankerEligibilityFloor(user.bankId);
    const eligible =
      auction.status === AuctionStatus.OPEN &&
      !isExpired(auction.endsAt) &&
      auction.account != null &&
      Number(auction.account.amount) >= floor;
    if (!eligible) throw new ForbiddenError('Auction not available to your bank');
    return auction;
  }

  // Non-bankers: reuse account access rules.
  await accountService.assertAccess(user, auction.accountId);
  return auction;
}

// ---- Banker: submit / update an offer (Blind) ------------------------------

async function submitOffer(user: AuthUser, auctionId: string, interestRate: number) {
  if (user.role !== Role.BANKER) throw new ForbiddenError('Only bankers can submit offers');
  if (!user.bankId) throw new ForbiddenError('Banker is not assigned to a bank');

  const auction = await auctionRepository.findById(auctionId);
  if (!auction) throw new NotFoundError('Auction not found');
  if (auction.status !== AuctionStatus.OPEN) {
    throw new BadRequestError('Auction is not open', 'AUCTION_NOT_OPEN');
  }
  if (isExpired(auction.endsAt)) {
    throw new BadRequestError('Auction has expired', 'AUCTION_EXPIRED');
  }

  // Eligibility check.
  const floor = await bankerEligibilityFloor(user.bankId);
  if (!auction.account || Number(auction.account.amount) < floor) {
    throw new ForbiddenError('Your bank is not eligible for this auction');
  }

  const offer = await offerRepository.upsert({
    auctionId,
    bankerId: user.id,
    bankId: user.bankId,
    interestRate,
  });

  // System-recorded activity (not via the events endpoint, which bankers cannot use).
  await eventDispatcher.record({
    accountId: auction.accountId,
    type: EventType.OFFER_SUBMITTED,
    createdById: user.id,
    payload: { auctionId, offerId: offer.id },
  });

  return offer;
}

// ---- Manager / Admin: close an auction (select winner) ---------------------

async function closeAuction(user: AuthUser, auctionId: string) {
  if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
    throw new ForbiddenError('Only managers or admins can close auctions');
  }

  const auction = await auctionRepository.findById(auctionId);
  if (!auction) throw new NotFoundError('Auction not found');
  await accountService.assertAccess(user, auction.accountId);
  if (auction.status !== AuctionStatus.OPEN) {
    throw new BadRequestError('Auction is not open', 'AUCTION_NOT_OPEN');
  }

  await finalizeAuction(auctionId, auction.accountId, user.id);
  return auctionRepository.findById(auctionId);
}

// Shared close logic (used by manual close and the expiry sweeper).
async function finalizeAuction(
  auctionId: string,
  accountId: string,
  actorId: string,
): Promise<void> {
  const offers = await offerRepository.listByAuction(auctionId);
  const best = selectWinningOffer(offers);

  if (!best) {
    // No offers → Expired; account returns to ACTIVE.
    await auctionRepository.update(auctionId, { status: AuctionStatus.EXPIRED });
    await accountRepository.update(accountId, { status: AccountStatus.ACTIVE });
    await eventDispatcher.record({
      accountId,
      type: EventType.AUCTION_CLOSED,
      createdById: actorId,
      payload: { auctionId, result: 'EXPIRED_NO_OFFERS' },
    });
    return;
  }

  // Winner = lowest rate (deterministic tie-break handled by the repository ordering).
  await offerRepository.markWinner(best.id);
  await auctionRepository.update(auctionId, {
    status: AuctionStatus.WON,
    winningOffer: { connect: { id: best.id } },
  });
  await accountRepository.update(accountId, { status: AccountStatus.WON });

  await eventDispatcher.record({
    accountId,
    type: EventType.AUCTION_CLOSED,
    createdById: actorId,
    payload: { auctionId, winningOfferId: best.id },
  });

  // The winning-offer-selected integration trigger.
  await crmService.sync(SyncTrigger.WINNING_OFFER_SELECTED, {
    auctionId,
    accountId,
    winningOfferId: best.id,
    interestRate: Number(best.interestRate),
  } satisfies Prisma.InputJsonValue);
}

// ---- Expiry sweeper (Cloudflare Cron Trigger — see src/worker.ts) -----------

// Closes every OPEN auction whose endsAt has passed. Reuses finalizeAuction, so a swept
// auction follows the exact same path as a manual close: winner → WON + CRM sync, or no
// offers → EXPIRED. One auction failing does not abort the rest of the batch.
async function sweepExpiredAuctions(now: Date = new Date()): Promise<{ swept: number; failed: number }> {
  const expired = await auctionRepository.findExpiredOpen(now);
  let swept = 0;
  let failed = 0;

  for (const auction of expired) {
    try {
      // No interactive actor on a cron run — attribute the close to whoever opened it.
      await finalizeAuction(auction.id, auction.accountId, auction.openedById);
      swept += 1;
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[sweep] failed to finalize auction ${auction.id}:`, err);
    }
  }

  return { swept, failed };
}

export const auctionService = {
  openAuction,
  listAuctions,
  getAuction,
  submitOffer,
  closeAuction,
  sweepExpiredAuctions,
};
