import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const syncLogRepository = {
  create(data: Prisma.SyncLogUncheckedCreateInput) {
    return prisma.syncLog.create({ data });
  },

  list(take = 200) {
    return prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  },
};
