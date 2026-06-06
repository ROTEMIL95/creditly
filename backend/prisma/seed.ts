import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

// Shared demo password for every seeded user.
const PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  // ---- Banks ---------------------------------------------------------------
  const bankA = await prisma.bank.upsert({
    where: { name: 'Bank Hapoalim' },
    update: { minAmount: 0 },
    create: { name: 'Bank Hapoalim', minAmount: 0 }, // eligible for everything
  });
  const bankB = await prisma.bank.upsert({
    where: { name: 'Bank Leumi' },
    update: { minAmount: 100000 },
    create: { name: 'Bank Leumi', minAmount: 100000 }, // only high-value accounts
  });

  // ---- Users (one per role + two bankers) ----------------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'admin@creditly.dev' },
    update: { passwordHash },
    create: { name: 'Alice Admin', email: 'admin@creditly.dev', passwordHash, role: Role.ADMIN },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@creditly.dev' },
    update: { passwordHash },
    create: { name: 'Mike Manager', email: 'manager@creditly.dev', passwordHash, role: Role.MANAGER },
  });
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@creditly.dev' },
    update: { passwordHash },
    create: { name: 'Uma User', email: 'user@creditly.dev', passwordHash, role: Role.USER },
  });
  // Additional managers — each manages their own accounts (demonstrates scoped RBAC).
  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@creditly.dev' },
    update: { passwordHash },
    create: { name: 'Sarah Manager', email: 'manager2@creditly.dev', passwordHash, role: Role.MANAGER },
  });
  const manager3 = await prisma.user.upsert({
    where: { email: 'manager3@creditly.dev' },
    update: { passwordHash },
    create: { name: 'David Manager', email: 'manager3@creditly.dev', passwordHash, role: Role.MANAGER },
  });
  await prisma.user.upsert({
    where: { email: 'banker.alpha@creditly.dev' },
    update: { bankId: bankA.id, name: 'Bob Banker (Hapoalim)', passwordHash },
    create: {
      name: 'Bob Banker (Hapoalim)',
      email: 'banker.alpha@creditly.dev',
      passwordHash,
      role: Role.BANKER,
      bankId: bankA.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'banker.beta@creditly.dev' },
    update: { bankId: bankB.id, name: 'Bella Banker (Leumi)', passwordHash },
    create: {
      name: 'Bella Banker (Leumi)',
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

  // ---- Accounts for the additional managers --------------------------------
  const extraAccounts = [
    { id: 'seed-account-s1', customerName: 'Emma Wilson', phone: '+1-555-0300', email: 'emma.wilson@example.com', amount: 80000, status: AccountStatus.ACTIVE, managerId: manager2.id },
    { id: 'seed-account-s2', customerName: 'Liam Brown', phone: '+1-555-0400', email: 'liam.brown@example.com', amount: 150000, status: AccountStatus.ACTIVE, managerId: manager2.id },
    { id: 'seed-account-d1', customerName: 'Olivia Davis', phone: '+1-555-0500', email: 'olivia.davis@example.com', amount: 45000, status: AccountStatus.ACTIVE, managerId: manager3.id },
    { id: 'seed-account-d2', customerName: 'Noah Miller', phone: '+1-555-0600', email: 'noah.miller@example.com', amount: 300000, status: AccountStatus.ACTIVE, managerId: manager3.id },
  ];
  for (const acc of extraAccounts) {
    await prisma.account.upsert({ where: { id: acc.id }, update: {}, create: acc });
  }

  // A seed event by the normal user so they are "related" to the low account.
  // Guarded so re-running the seed doesn't accumulate duplicate events.
  const existingSeedEvent = await prisma.event.findFirst({
    where: { accountId: 'seed-account-low', createdById: normalUser.id, type: 'NOTE_ADDED' },
  });
  if (!existingSeedEvent) {
    await prisma.event.create({
      data: {
        accountId: 'seed-account-low',
        type: 'NOTE_ADDED',
        createdById: normalUser.id,
        payload: { note: 'Initial contact made.' },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete. Users (password for all: %s):', PASSWORD);
  // eslint-disable-next-line no-console
  console.log('   admin@creditly.dev | user@creditly.dev');
  // eslint-disable-next-line no-console
  console.log('   Managers: manager@creditly.dev (Mike) | manager2@creditly.dev (Sarah) | manager3@creditly.dev (David)');
  // eslint-disable-next-line no-console
  console.log('   banker.alpha@creditly.dev (Bank Hapoalim) | banker.beta@creditly.dev (Bank Leumi)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
