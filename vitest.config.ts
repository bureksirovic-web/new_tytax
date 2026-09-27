import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Only the names the skip lint covers (R09); scripts/data tests live under scripts/.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // Fails the run on any skipped / todo / .fails test (R10). A CLI --reporter replaces this list.
    reporters: ['default', './vitest.no-skips-reporter.ts'],
    // *.sync.test.ts needs a local Supabase; it runs only via `npm run test:sync` (vitest.sync.config.ts).
    exclude: ['e2e/**', '**/e2e/**', 'node_modules/**', '.next/**', '**/*.sync.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 15,
        statements: 20,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.tsx', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
