import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { Role } from '@prisma/client';

import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { authController } from '../controllers/authController.js';
import { accountController } from '../controllers/accountController.js';
import { eventController } from '../controllers/eventController.js';
import { auctionController } from '../controllers/auctionController.js';
import { analyticsController } from '../controllers/analyticsController.js';
import { loginSchema, createEventSchema, submitOfferSchema } from './schemas.js';
import type { AppEnv } from '../types/index.js';

export function buildRoutes() {
  const api = new Hono<AppEnv>();

  // ---- Auth ----------------------------------------------------------------
  api.post('/auth/login', zValidator('json', loginSchema), authController.login);
  api.post('/auth/logout', authController.logout);
  api.get('/auth/me', requireAuth, authController.me);

  // ---- Accounts (no banker access) -----------------------------------------
  api.get('/accounts', requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.USER), accountController.list);
  api.get('/accounts/:id', requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.USER), accountController.getById);

  // ---- Events --------------------------------------------------------------
  api.post(
    '/events',
    requireAuth,
    requireRole(Role.ADMIN, Role.MANAGER, Role.USER),
    zValidator('json', createEventSchema),
    eventController.create,
  );

  // ---- Auctions ------------------------------------------------------------
  // Open an auction for an account (manager/admin).
  api.post(
    '/accounts/:id/auctions',
    requireAuth,
    requireRole(Role.ADMIN, Role.MANAGER),
    auctionController.open,
  );
  // List auctions (role-aware; bankers get masked, eligibility-filtered results).
  api.get('/auctions', requireAuth, auctionController.list);
  api.get('/auctions/:id', requireAuth, auctionController.getById);
  // Submit an offer (banker only).
  api.post(
    '/auctions/:id/offers',
    requireAuth,
    requireRole(Role.BANKER),
    zValidator('json', submitOfferSchema),
    auctionController.submitOffer,
  );
  // Close an auction → select winner (manager/admin).
  api.post(
    '/auctions/:id/close',
    requireAuth,
    requireRole(Role.ADMIN, Role.MANAGER),
    auctionController.close,
  );

  // ---- Analytics (admin) ---------------------------------------------------
  api.get('/analytics/summary', requireAuth, requireRole(Role.ADMIN), analyticsController.summary);

  return api;
}
