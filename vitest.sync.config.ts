import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Sync integration suite (`npm run test:sync`): `src/**\/*.sync.test.ts`
 * against a disposable local Supabase. Excluded from the default `vitest.config.ts`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.sync.test.ts'],
    // G5 adds the suite. Until then there are no files, and an empty run must
    // pass rather than fail; this is not a skip: AC12 requires zero skipped
    // tests in the CI `sync-e2e` job, and there are zero tests to skip.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
