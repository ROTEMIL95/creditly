import { AuctionStatus, SyncStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const analyticsRepository = {
  async summary() {
    const [
      totalAccounts,
      highActivityAccounts,
      accountsByStatus,
      openAuctions,
      wonAuctions,
      expiredAuctions,
      totalOffers,
      failedSyncs,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({ where: { isHighActivity: true } }),
      prisma.account.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.auctionOpportunity.count({ where: { status: AuctionStatus.OPEN } }),
      prisma.auctionOpportunity.count({ where: { status: AuctionStatus.WON } }),
      prisma.auctionOpportunity.count({ where: { status: AuctionStatus.EXPIRED } }),
      prisma.bankOffer.count(),
      prisma.syncLog.count({ where: { status: SyncStatus.FAILED } }),
    ]);

    return {
      totalAccounts,
      highActivityAccounts,
      accountsByStatus: Object.fromEntries(
        accountsByStatus.map((row) => [row.status, row._count._all]),
      ),
      auctions: { open: openAuctions, won: wonAuctions, expired: expiredAuctions },
      totalOffers,
      failedSyncs,
    };
  },
};
