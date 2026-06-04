import { analyticsRepository } from '../repositories/analyticsRepository.js';

// System-wide summary (route is admin-guarded).
async function summary() {
  return analyticsRepository.summary();
}

export const analyticsService = { summary };
