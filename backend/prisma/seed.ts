import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

// Shared demo password for every seeded user.
const PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  // ---- Banks ---------------------------------------------------------------
  const bankA = await prisma.bank.upsert({
    where: { name: 'Bank Alpha' },
    update: { minAmount: 0 },
    create: { name: 'Bank Alpha', minAmount: 0 }, // eligible for everything
  });
  const bankB = await prisma.bank.upsert({
    where: { name: 'Bank Beta' },
    update: { minAmount: 100000 },
    create: { name: 'Bank Beta', minAmount: 100000 }, // only high-value accounts
  });

  // ---- Users (one per role + two bankers) ----------------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'admin@creditly.dev' },
    update: {},
    create: { name: 'Alice Admin', email: 'admin@creditly.dev', passwordHash, role: Role.ADMIN },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@creditly.dev' },
    update: {},
    create: { name: 'Mike Manager', email: 'manager@creditly.dev', passwordHash, role: Role.MANAGER },
  });
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@creditly.dev' },
    update: {},
    create: { name: 'Uma User', email: 'user@creditly.dev', passwordHash, role: Role.USER },
  });
  await prisma.user.upsert({
    where: { email: 'banker.alpha@creditly.dev' },
    update: { bankId: bankA.id },
    create: {
      name: 'Bob Banker (Alpha)',
      email: 'banker.alpha@creditly.dev',
      passwordHash,
      role: Role.BANKER,
      bankId: bankA.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'banker.beta@creditly.dev' },
    update: { bankId: bankB.id },
    create: {
      name: 'Bella Banker (Beta)',
      email: 'banker.beta@creditly.dev',
      passwordHash,
      role: Role.BANKER,
      bankId: bankB.id,
    },
  });

  // ---- Accounts (managed by Mike) ------------------------------------------
  await prisma.account.upsert({
    where: { id: 'seed-account-low' },
    update: {},
    create: {
      id: 'seed-account-low',
      customerName: 'John Doe',
      phone: '+1-555-0100',
      email: 'john.doe@example.com',
      amount: 25000,
      status: AccountStatus.ACTIVE,
      managerId: manager.id,
    },
  });
  await prisma.account.upsert({
    where: { id: 'seed-account-high' },
    update: {},
    create: {
      id: 'seed-account-high',
      customerName: 'Jane Smith',
      phone: '+1-555-0200',
      email: 'jane.smith@example.com',
      amount: 250000, // eligible for both banks
      status: AccountStatus.ACTIVE,
      managerId: manager.id,
    },
  });

  // A seed event by the normal user so they are "related" to the low account.
  await prisma.event.create({
    data: {
      accountId: 'seed-account-low',
      type: 'NOTE_ADDED',
      createdById: normalUser.id,
      payload: { note: 'Initial contact made.' },
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete. Users (password for all: %s):', PASSWORD);
  // eslint-disable-next-line no-console
  console.log('   admin@creditly.dev | manager@creditly.dev | user@creditly.dev');
  // eslint-disable-next-line no-console
  console.log('   banker.alpha@creditly.dev (Bank Alpha) | banker.beta@creditly.dev (Bank Beta)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
