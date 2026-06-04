import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Role, AccountStatus, AuctionStatus } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signToken } from '../../src/lib/jwt.js';
import { hashPassword } from '../../src/lib/password.js';

// Real API integration tests for RBAC — requests flow through the full Hono pipeline
// (route → requireAuth → requireRole → zod → controller → service → serializer) against
// the live database. All fixtures are namespaced `itest-` and cleaned up; seed data is untouched.

const app = createApp();
const P = 'itest-';

// Distinctive PII strings so we can assert they never leak to a banker.
const PII = { name: 'Secret Person', phone: '+1-555-9999', email: 'secret@example.com' };

let tokenMgrA: string;
let tokenMgrB: string;
let tokenBanker: string;

const auth = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

const postJson = (token: string, body: unknown) => ({
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function cleanup() {
  // Deleting accounts cascades their events, auctions, and offers (see schema onDelete: Cascade).
  await prisma.account.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.bank.deleteMany({ where: { id: { startsWith: P } } });
}

beforeAll(async () => {
  await cleanup();
  const passwordHash = await hashPassword('Password123!');

  await prisma.bank.create({ data: { id: `${P}bank`, name: `${P}Bank`, minAmount: 0 } });

  await prisma.user.createMany({
    data: [
      { id: `${P}mgrA`, name: 'Manager A', email: `${P}mgrA@x.dev`, passwordHash, role: Role.MANAGER },
      { id: `${P}mgrB`, name: 'Manager B', email: `${P}mgrB@x.dev`, passwordHash, role: Role.MANAGER },
      { id: `${P}banker`, name: 'Banker', email: `${P}banker@x.dev`, passwordHash, role: Role.BANKER, bankId: `${P}bank` },
    ],
  });

  await prisma.account.createMany({
    data: [
      { id: `${P}acc-a`, customerName: PII.name, phone: PII.phone, email: PII.email, amount: 5000, status: AccountStatus.IN_AUCTION, managerId: `${P}mgrA` },
      { id: `${P}acc-b`, customerName: 'Other Customer', phone: '+1-555-0000', email: 'other@x.dev', amount: 5000, status: AccountStatus.ACTIVE, managerId: `${P}mgrB` },
    ],
  });

  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.auctionOpportunity.createMany({
    data: [
      { id: `${P}auc-open`, accountId: `${P}acc-a`, openedById: `${P}mgrA`, status: AuctionStatus.OPEN, endsAt: in3Days },
      { id: `${P}auc-expired`, accountId: `${P}acc-a`, openedById: `${P}mgrA`, status: AuctionStatus.OPEN, endsAt: past },
      { id: `${P}auc-closed`, accountId: `${P}acc-b`, openedById: `${P}mgrB`, status: AuctionStatus.WON, endsAt: in3Days },
    ],
  });

  tokenMgrA = await signToken({ sub: `${P}mgrA`, role: Role.MANAGER, bankId: null });
  tokenMgrB = await signToken({ sub: `${P}mgrB`, role: Role.MANAGER, bankId: null });
  tokenBanker = await signToken({ sub: `${P}banker`, role: Role.BANKER, bankId: `${P}bank` });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('RBAC — unauthorized access', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await app.request('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('forbids a BANKER from listing accounts (403)', async () => {
    const res = await app.request('/api/accounts', auth(tokenBanker));
    expect(res.status).toBe(403);
  });

  it("forbids a MANAGER from reading an account they don't manage (403)", async () => {
    const res = await app.request(`/api/accounts/${P}acc-b`, auth(tokenMgrA));
    expect(res.status).toBe(403);
  });
});

describe('RBAC — data masking (banker never sees PII)', () => {
  it('GET /auctions/:id as banker returns NO customer PII', async () => {
    const res = await app.request(`/api/auctions/${P}auc-open`, auth(tokenBanker));
    expect(res.status).toBe(200);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain(PII.name);
    expect(raw).not.toContain(PII.phone);
    expect(raw).not.toContain(PII.email);
  });

  it('banker auction view exposes only own offers (Blind), not a competitor list', async () => {
    const res = await app.request(`/api/auctions/${P}auc-open`, auth(tokenBanker));
    const body = await res.json();
    expect(body.auction).toHaveProperty('myOffers');
    expect(body.auction).not.toHaveProperty('offers');
  });
});

describe('RBAC — scoped access (managers see only their own accounts)', () => {
  it('Manager A sees account A but NOT account B', async () => {
    const res = await app.request('/api/accounts', auth(tokenMgrA));
    expect(res.status).toBe(200);
    const ids: string[] = (await res.json()).accounts.map((a: { id: string }) => a.id);
    expect(ids).toContain(`${P}acc-a`);
    expect(ids).not.toContain(`${P}acc-b`);
  });

  it('Manager B sees account B but NOT account A', async () => {
    const res = await app.request('/api/accounts', auth(tokenMgrB));
    const ids: string[] = (await res.json()).accounts.map((a: { id: string }) => a.id);
    expect(ids).toContain(`${P}acc-b`);
    expect(ids).not.toContain(`${P}acc-a`);
  });
});

describe('RBAC × business logic — offers on expired / closed auctions', () => {
  it('rejects a banker offer on an EXPIRED auction (400 AUCTION_EXPIRED)', async () => {
    const res = await app.request(`/api/auctions/${P}auc-expired/offers`, postJson(tokenBanker, { interestRate: 5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('AUCTION_EXPIRED');
  });

  it('rejects a banker offer on a CLOSED auction (400 AUCTION_NOT_OPEN)', async () => {
    const res = await app.request(`/api/auctions/${P}auc-closed/offers`, postJson(tokenBanker, { interestRate: 5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('AUCTION_NOT_OPEN');
  });
});
