import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Same ".js → .ts" resolver as vitest.config.ts (source uses ESM-style .js specifiers).
const jsToTs = {
  name: 'js-to-ts-resolver',
  enforce: 'pre' as const,
  resolveId(source: string, importer: string | undefined) {
    if (importer && source.endsWith('.js') && (source.startsWith('./') || source.startsWith('../'))) {
      const candidate = resolve(dirname(importer), source.replace(/\.js$/, '.ts'));
      if (existsSync(candidate)) return candidate;
    }
    return null;
  },
};

// Integration suite — hits the live (Supabase) database. Requires a configured .env
// and a migrated DB. Run with: npm run test:integration
export default defineConfig({
  plugins: [jsToTs],
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false, // integration tests share one DB — run serially
  },
});
