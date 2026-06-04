import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Source uses ESM-style ".js" import specifiers (required for NodeNext output).
// This plugin lets Vitest resolve those to the actual ".ts" files during tests.
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

export default defineConfig({
  plugins: [jsToTs],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests hit the live DB — run them via `npm run test:integration`.
    exclude: ['tests/integration/**', 'node_modules/**'],
    globals: false,
  },
});
