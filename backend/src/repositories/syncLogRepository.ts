import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const syncLogRepository = {
  create(data: Prisma.SyncLogUncheckedCreateInput) {
    return prisma.syncLog.create({ data });
  },

  list() {
    return prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' } });
  },
};
