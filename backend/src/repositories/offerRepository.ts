import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const offerRepository = {
  // Blind model: one offer per banker per auction, updatable while open.
  upsert(params: {
    auctionId: string;
    bankerId: string;
    bankId: string;
    interestRate: Prisma.Decimal | number;
  }) {
    const { auctionId, bankerId, bankId, interestRate } = params;
    return prisma.bankOffer.upsert({
      where: { auctionId_bankerId: { auctionId, bankerId } },
      create: { auctionId, bankerId, bankId, interestRate },
      update: { interestRate },
    });
  },

  // All offers for an auction (winner is chosen by the pure selectWinningOffer logic).
  // Ordered for readability/determinism; the authoritative tie-break is in auctionLogic.
  listByAuction(auctionId: string) {
    return prisma.bankOffer.findMany({
      where: { auctionId },
      orderBy: [{ interestRate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  },

  markWinner(offerId: string) {
    return prisma.bankOffer.update({ where: { id: offerId }, data: { isWinner: true } });
  },
};
