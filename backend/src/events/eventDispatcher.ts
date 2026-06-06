import { EventType, SyncTrigger, AuditAction, AuditEntity, Prisma } from '@prisma/client';
import { eventRepository } from '../repositories/eventRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { crmService } from '../integration/crmService.js';
import { auditService } from '../services/auditService.js';

const HIGH_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const HIGH_ACTIVITY_THRESHOLD = 3; // strictly MORE than 3 events in 24h

// Maps an event type to its CRM sync trigger (only some events sync to the CRM).
const EVENT_TO_CRM_TRIGGER: Partial<Record<EventType, SyncTrigger>> = {
  [EventType.DOCUMENT_UPLOADED]: SyncTrigger.DOCUMENT_UPLOADED,
  [EventType.STATUS_CHANGED]: SyncTrigger.STATUS_CHANGED,
  [EventType.AUCTION_OPENED]: SyncTrigger.AUCTION_OPENED,
};

// Every domain event is also written to the comprehensive audit trail (admin-visible).
const EVENT_TO_AUDIT_ACTION: Record<EventType, AuditAction> = {
  [EventType.DOCUMENT_UPLOADED]: AuditAction.DOCUMENT_UPLOADED,
  [EventType.STATUS_CHANGED]: AuditAction.STATUS_CHANGED,
  [EventType.NOTE_ADDED]: AuditAction.NOTE_ADDED,
  [EventType.AUCTION_OPENED]: AuditAction.AUCTION_OPENED,
  [EventType.OFFER_SUBMITTED]: AuditAction.OFFER_SUBMITTED, // → OFFER_UPDATED when a previous rate exists
  [EventType.AUCTION_CLOSED]: AuditAction.AUCTION_CLOSED,
};

export interface RecordEventInput {
  accountId: string;
  type: EventType;
  createdById: string;
  payload?: Prisma.InputJsonValue;
}

// The single choke point for system events. Persists the event, then applies
// the mandatory business rules and fires integration triggers.
async function record(input: RecordEventInput) {
  const event = await eventRepository.create({
    accountId: input.accountId,
    type: input.type,
    createdById: input.createdById,
    payload: input.payload,
  });

  await applyBusinessRules(input);
  await recordAudit(input);

  const trigger = EVENT_TO_CRM_TRIGGER[input.type];
  if (trigger) {
    await crmService.sync(trigger, {
      accountId: input.accountId,
      eventId: event.id,
      type: input.type,
    });
  }

  return event;
}

// Mirror the domain event into the audit trail. OFFER_SUBMITTED becomes OFFER_UPDATED when
// the payload carries a previousRate (a banker revising an existing offer).
async function recordAudit(input: RecordEventInput) {
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  let action = EVENT_TO_AUDIT_ACTION[input.type];
  if (input.type === EventType.OFFER_SUBMITTED && payload.previousRate != null) {
    action = AuditAction.OFFER_UPDATED;
  }
  await auditService.record({
    action,
    actorId: input.createdById,
    entityType: AuditEntity.ACCOUNT,
    entityId: input.accountId,
    metadata: input.payload,
  });
}

async function applyBusinessRules(input: RecordEventInput) {
  // Rule: more than 3 events in 24h → mark account as High Activity.
  const since = new Date(Date.now() - HIGH_ACTIVITY_WINDOW_MS);
  const recentCount = await eventRepository.countSince(input.accountId, since);
  if (recentCount > HIGH_ACTIVITY_THRESHOLD) {
    await accountRepository.update(input.accountId, { isHighActivity: true });
  }

  // Rule: document_uploaded → update lastActivity.
  if (input.type === EventType.DOCUMENT_UPLOADED) {
    await accountRepository.update(input.accountId, { lastActivity: new Date() });
  }
}

export const eventDispatcher = { record };
export { EventType };
