import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

const withRelations = {
  account: true,
  offers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AuctionOpportunityInclude;

export const auctionRepository = {
  create(data: Prisma.AuctionOpportunityUncheckedCreateInput) {
    return prisma.auctionOpportunity.create({ data, include: withRelations });
  },

  findById(id: string) {
    return prisma.auctionOpportunity.findUnique({ where: { id }, include: withRelations });
  },

  list(where: Prisma.AuctionOpportunityWhereInput = {}) {
    return prisma.auctionOpportunity.findMany({
      where,
      include: withRelations,
      orderBy: { createdAt: 'desc' },
    });
  },

  update(id: string, data: Prisma.AuctionOpportunityUpdateInput) {
    return prisma.auctionOpportunity.update({ where: { id }, data, include: withRelations });
  },

  // Open auctions that an account already has (one active auction per account at a time).
  findOpenByAccount(accountId: string) {
    return prisma.auctionOpportunity.findFirst({
      where: { accountId, status: 'OPEN' },
    });
  },
};
