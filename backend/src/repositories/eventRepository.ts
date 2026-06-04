import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const eventRepository = {
  create(data: Prisma.EventUncheckedCreateInput) {
    return prisma.event.create({ data });
  },

  listByAccount(accountId: string) {
    return prisma.event.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Number of events recorded on an account since the given time (for High Activity rule).
  countSince(accountId: string, since: Date) {
    return prisma.event.count({
      where: { accountId, createdAt: { gte: since } },
    });
  },

  // Accounts the user is "related to" (created at least one event on).
  accountIdsForCreator(createdById: string) {
    return prisma.event
      .findMany({ where: { createdById }, select: { accountId: true }, distinct: ['accountId'] })
      .then((rows) => rows.map((r) => r.accountId));
  },
};
