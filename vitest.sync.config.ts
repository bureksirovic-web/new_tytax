import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Sync integration suite (`npm run test:sync`): `src/**\/*.sync.test.ts`
 * against a disposable local Supabase. Excluded from the default `vitest.config.ts`.
 * No `passWithNoTests`: an empty run fails. Missing Supabase env fails the
 * suite in `beforeAll` (src/lib/sync/__tests__/live-harness.ts), never skips.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.sync.test.ts'],
    // Fails the run on any skipped / todo / .fails test (R10). A CLI --reporter replaces this list.
    reporters: ['default', './vitest.no-skips-reporter.ts'],
    // The suite builds on its own state (one account, two devices): no file parallelism.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
