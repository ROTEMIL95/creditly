import { AuditAction, AuditEntity, Role, Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/auditRepository.js';
import { syncLogRepository } from '../repositories/syncLogRepository.js';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | null;
  entityType?: AuditEntity | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

// Best-effort write — the audit trail must NEVER break the action it records.
async function record(entry: AuditEntry): Promise<void> {
  try {
    await auditRepository.create({
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      actorRole: entry.actorRole ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record entry:', err);
  }
}

// Unified, newest-first timeline for the admin: app actions (AuditLog — logins, offers with
// rate deltas, auction/account events) + CRM integration outcomes (SyncLog).
async function list(limit = 200) {
  const [audits, syncs] = await Promise.all([
    auditRepository.list(limit),
    syncLogRepository.list(limit),
  ]);

  const fromAudit = audits.map((a) => ({
    id: a.id,
    action: a.action as string,
    actor: a.actor ? { name: a.actor.name, email: a.actor.email, role: a.actor.role } : null,
    actorEmail: a.actorEmail,
    entityType: a.entityType as string | null,
    entityId: a.entityId,
    metadata: a.metadata as unknown,
    createdAt: a.createdAt,
  }));

  const fromSync = syncs.map((s) => ({
    id: s.id,
    action: 'CRM_SYNC',
    actor: null as { name: string; email: string; role: Role } | null,
    actorEmail: null as string | null,
    entityType: null as string | null,
    entityId: null as string | null,
    metadata: {
      trigger: s.trigger,
      syncStatus: s.status,
      attempts: s.attempts,
      ...(s.failureReason ? { failureReason: s.failureReason } : {}),
    } as unknown,
    createdAt: s.createdAt,
  }));

  return [...fromAudit, ...fromSync]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export const auditService = { record, list };
