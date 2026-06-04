import { EventType, Role, Prisma } from '@prisma/client';
import { eventDispatcher } from '../events/eventDispatcher.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { accountService } from './accountService.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';

export interface CreateEventInput {
  accountId: string;
  type: EventType;
  payload?: Prisma.InputJsonValue;
}

// HTTP-facing event creation with authorization. Delegates the actual recording
// (+ business rules + CRM triggers) to the domain dispatcher.
async function createEvent(user: AuthUser, input: CreateEventInput) {
  if (user.role === Role.BANKER) {
    throw new ForbiddenError('Bankers cannot create events');
  }

  const account = await accountRepository.findById(input.accountId);
  if (!account) throw new NotFoundError('Account not found');

  // Managers may only act on their own accounts; admins and users may act on any account.
  if (user.role === Role.MANAGER && account.managerId !== user.id) {
    throw new ForbiddenError('You are not the manager of this account');
  }

  return eventDispatcher.record({
    accountId: input.accountId,
    type: input.type,
    createdById: user.id,
    payload: input.payload,
  });
}

async function listByAccount(user: AuthUser, accountId: string) {
  await accountService.assertAccess(user, accountId);
  return eventRepository.listByAccount(accountId);
}

export const eventService = { createEvent, listByAccount };
