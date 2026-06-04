import 'dotenv/config';

// Integration tests talk to the DB directly (session mode, port 5432) rather than through
// the transaction pooler (6543). The direct connection is the right choice for setup/teardown
// and avoids the free-tier pooler's low connection cap. Must run before the Prisma client
// is constructed (vitest executes setupFiles before the test module's imports).
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
