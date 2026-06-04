import { describe, it, expect, vi, afterEach } from 'vitest';
import { Role } from '@prisma/client';
import { accountService } from '../src/services/accountService.js';
import { accountRepository } from '../src/repositories/accountRepository.js';
import { eventRepository } from '../src/repositories/eventRepository.js';
import { ForbiddenError } from '../src/lib/errors.js';
import type { AuthUser } from '../src/types/index.js';

const banker: AuthUser = { id: 'b1', role: Role.BANKER, bankId: 'bankA' };
const manager: AuthUser = { id: 'mgr1', role: Role.MANAGER, bankId: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accountOwnedBy = (managerId: string): any => ({
  id: 'acc1',
  customerName: 'Jane',
  phone: 'x',
  email: 'x',
  status: 'ACTIVE',
  amount: 1000,
  managerId,
  isHighActivity: false,
  lastActivity: null,
  manager: { id: managerId, name: 'M' },
  auctions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('RBAC enforcement (server-side)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forbids a banker from listing accounts', async () => {
    await expect(accountService.list(banker)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('forbids a banker from reading an account directly', async () => {
    await expect(accountService.getById(banker, 'acc1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('forbids a manager from reading an account they do not manage', async () => {
    vi.spyOn(accountRepository, 'findById').mockResolvedValue(accountOwnedBy('someone-else'));
    await expect(accountService.getById(manager, 'acc1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows a manager to read an account they manage', async () => {
    vi.spyOn(accountRepository, 'findById').mockResolvedValue(accountOwnedBy('mgr1'));
    vi.spyOn(eventRepository, 'listByAccount').mockResolvedValue([]);
    const { account } = await accountService.getById(manager, 'acc1');
    expect(account.id).toBe('acc1');
  });
});
