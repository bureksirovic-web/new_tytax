import { defineConfig, devices } from '@playwright/test';

/**
 * Test isolation (PLAN §10.1 W0.2): every goal/worktree runs its own server on
 * its own port (G1 3101 … G5 3105, integration 3100) and never reuses one.
 * The global setup then asserts the server's `/api/health` SHA equals this
 * worktree's HEAD, so a run can never silently test another worktree's code.
 *
 * `E2E_SERVER=prod` serves an existing `next build` with `next start`. The
 * e2e hooks are compiled in only when that build ran with NEXT_PUBLIC_E2E_HOOKS=1
 * (NEXT_PUBLIC_* is inlined at build time); `next dev` always has them.
 */
const PORT = process.env.PORT ?? '3100';
const baseURL = `http://127.0.0.1:${PORT}`;

// `-H 127.0.0.1`: keep the server off the LAN, and make 127.0.0.1 the dev
// server's own hostname so Next's cross-origin dev guard allows its assets.
const serverCommand =
  process.env.E2E_SERVER === 'prod'
    ? `npx next start -p ${PORT} -H 127.0.0.1`
    : `npx next dev -p ${PORT} -H 127.0.0.1`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Playwright 1.58 runs plugin setup (the webServer, which waits for `url`)
  // before globalSetup (runner/tasks.js createGlobalSetupTasks), so the
  // server is up when the SHA guard runs.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: serverCommand,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_PUBLIC_E2E_HOOKS: '1' },
  },
});
