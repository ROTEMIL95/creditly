import { prisma } from '../config/prisma.js';

export const bankRepository = {
  findById(id: string) {
    return prisma.bank.findUnique({ where: { id } });
  },

  list() {
    return prisma.bank.findMany({ orderBy: { name: 'asc' } });
  },
};
