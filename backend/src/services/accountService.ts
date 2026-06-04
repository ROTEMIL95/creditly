import { Role } from '@prisma/client';
import { accountRepository } from '../repositories/accountRepository.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';

// Returns the account if the user is allowed to access it, else throws.
// Bankers have NO direct account access (they only ever see masked auction data).
async function assertAccess(user: AuthUser, accountId: string) {
  if (user.role === Role.BANKER) {
    throw new ForbiddenError('Bankers cannot access customer accounts');
  }

  const account = await accountRepository.findById(accountId);
  if (!account) throw new NotFoundError('Account not found');

  if (user.role === Role.ADMIN) return account;

  if (user.role === Role.MANAGER) {
    if (account.managerId !== user.id) {
      throw new ForbiddenError('You are not the manager of this account');
    }
    return account;
  }

  // USER: only accounts they are related to (created at least one event on).
  const relatedIds = await eventRepository.accountIdsForCreator(user.id);
  if (!relatedIds.includes(accountId)) {
    throw new ForbiddenError('You do not have access to this account');
  }
  return account;
}

async function list(user: AuthUser) {
  switch (user.role) {
    case Role.BANKER:
      throw new ForbiddenError('Bankers cannot access customer accounts');
    case Role.ADMIN:
      return accountRepository.list();
    case Role.MANAGER:
      return accountRepository.list({ managerId: user.id });
    case Role.USER: {
      const relatedIds = await eventRepository.accountIdsForCreator(user.id);
      return accountRepository.list({ id: { in: relatedIds } });
    }
  }
}

async function getById(user: AuthUser, accountId: string) {
  const account = await assertAccess(user, accountId);
  const events = await eventRepository.listByAccount(accountId);
  return { account, events };
}

export const accountService = { list, getById, assertAccess };
