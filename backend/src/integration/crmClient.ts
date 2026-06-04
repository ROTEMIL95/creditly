import { env } from '../config/env.js';

// Raw "mock CRM" transport. In a real system this would be an HTTP call to an external
// CRM; here it simulates latency and a configurable failure rate (CRM_FAIL_RATE) so we
// can exercise the retry/failure paths.
export interface CrmClient {
  send(trigger: string, payload: unknown): Promise<void>;
}

export const crmClient: CrmClient = {
  async send(trigger, _payload) {
    // Deterministic-ish failure based on configured rate (0 = always succeed, 1 = always fail).
    if (env.CRM_FAIL_RATE > 0 && Math.random() < env.CRM_FAIL_RATE) {
      throw new Error(`Mock CRM rejected trigger "${trigger}"`);
    }
    // Simulated success — no-op.
  },
};

// A client that always fails — handy for tests asserting failure handling.
export function createFailingClient(reason = 'Mock CRM unavailable'): CrmClient {
  return {
    async send() {
      throw new Error(reason);
    },
  };
}
