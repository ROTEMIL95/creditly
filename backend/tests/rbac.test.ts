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

describe('RBAC enforcement (server-side, in the service layer)', () => {
  afterEach(() => vi.restoreAllMocks());

  // A banker has no route to customer data: accountService rejects both list and read.
  it('forbids a BANKER from listing or reading accounts', async () => {
    await expect(accountService.list(banker)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(accountService.getById(banker, 'acc1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  // A manager is scoped to accounts they own: denied on others, allowed on their own.
  it('scopes a MANAGER to accounts they own', async () => {
    const findById = vi.spyOn(accountRepository, 'findById');

    findById.mockResolvedValue(accountOwnedBy('someone-else'));
    await expect(accountService.getById(manager, 'acc1')).rejects.toBeInstanceOf(ForbiddenError);

    findById.mockResolvedValue(accountOwnedBy('mgr1'));
    vi.spyOn(eventRepository, 'listByAccount').mockResolvedValue([]);
    const { account } = await accountService.getById(manager, 'acc1');
    expect(account.id).toBe('acc1');
  });
});
