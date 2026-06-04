import { SyncTrigger, SyncStatus, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { syncLogRepository } from '../repositories/syncLogRepository.js';
import { crmClient, type CrmClient } from './crmClient.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface SyncResult {
  status: SyncStatus;
  attempts: number;
  failureReason?: string;
}

export interface SyncOptions {
  client?: CrmClient;
  maxRetries?: number;
  baseDelayMs?: number;
}

// Dedicated integration service (never called from a controller — only from domain
// services). Retries with exponential backoff, then records the outcome in SyncLog.
async function sync(
  trigger: SyncTrigger,
  payload: Prisma.InputJsonValue,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const client = options.client ?? crmClient;
  const maxRetries = options.maxRetries ?? env.CRM_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? env.CRM_RETRY_BASE_MS;

  let attempts = 0;
  let lastError = '';

  for (let i = 0; i <= maxRetries; i++) {
    attempts = i + 1;
    try {
      await client.send(trigger, payload);
      await syncLogRepository.create({ trigger, status: SyncStatus.SUCCESS, attempts, payload });
      return { status: SyncStatus.SUCCESS, attempts };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i < maxRetries) {
        await sleep(baseDelayMs * 2 ** i); // exponential backoff
      }
    }
  }

  // All attempts exhausted — persist the failure for auditing/retry visibility.
  await syncLogRepository.create({
    trigger,
    status: SyncStatus.FAILED,
    failureReason: lastError,
    attempts,
    payload,
  });
  return { status: SyncStatus.FAILED, attempts, failureReason: lastError };
}

export const crmService = { sync };
export { SyncTrigger };
