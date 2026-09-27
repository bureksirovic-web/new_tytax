import { defineConfig } from 'vitest/config';
import path from 'path';

/** `vitest run --coverage` (npm run test:coverage, CI). */
const COVERAGE = process.argv.some((a) => /^--coverage(\.enabled)?(=true)?$/.test(a));

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
    // Wall-clock budgets (e.g. w2-prs-restore-stamp-perf) read this: v8 coverage slows the code under test ~3.5x.
    env: { TYTAX_COVERAGE: COVERAGE ? '1' : '' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      // Global floor for everything measured; src/lib and src/stores carry their own (G5 INTEGRATION step 3).
      // Per-glob thresholds aggregate over the glob's files, not per file.
      // Branches are held at 60 %, below the 70 % of the other metrics: defensive
      // fallbacks (?? / optional chaining on IndexedDB rows) count as branches.
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 15,
        statements: 20,
        'src/lib/**': { lines: 70, statements: 70, functions: 70, branches: 60 },
        'src/stores/**': { lines: 70, statements: 70, functions: 70, branches: 60 },
      },
      // src/lib/** and src/stores/** plus every other .ts module under src/, as before;
      // .tsx components are measured by e2e, not here (no .tsx lives under src/lib or src/stores).
      include: ['src/lib/**/*.ts', 'src/stores/**/*.ts', 'src/**/*.ts'],
      // Tests and their helpers (__tests__/*.ts) are not product code.
      exclude: ['src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.test.ts', 'src/**/__tests__/**', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
