import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const auditRepository = {
  create(data: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data });
  },

  list(take = 200) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    });
  },
};
