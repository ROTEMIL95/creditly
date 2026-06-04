import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const accountRepository = {
  // Manager sees only assigned accounts; user sees only related (created an event) accounts.
  list(where: Prisma.AccountWhereInput = {}) {
    return prisma.account.findMany({
      where,
      include: { manager: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return prisma.account.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true } },
        auctions: { orderBy: { createdAt: 'desc' } },
      },
    });
  },

  update(id: string, data: Prisma.AccountUpdateInput) {
    return prisma.account.update({ where: { id }, data });
  },
};
