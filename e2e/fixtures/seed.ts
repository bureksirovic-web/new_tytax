import type { Page } from '@playwright/test';
import type { Profile, Program, WorkoutLog } from '../../src/contracts/domain';
import type {
  E2EStateSnapshot,
  SeedLogInput,
  SeedProfileInput,
  SeedProgramInput,
} from '../../src/contracts/fixtures';

/**
 * The `tytax` fixture: a thin wrapper over `window.__tytaxE2E`
 * (src/components/providers/e2e-hooks.ts). Every call runs in the page, so
 * data goes through the app's own repository, never around it.
 */
export interface TytaxFixture {
  /** `page.goto(path)`, then wait until the app installed its e2e hooks. */
  gotoApp(path: string): Promise<void>;
  /** Wipe IndexedDB and the persisted draft, then reload and wait for the app. */
  reset(): Promise<void>;
  seedProfile(input?: SeedProfileInput): Promise<Profile>;
  seedHistory(profileId: string, logs: SeedLogInput[]): Promise<WorkoutLog[]>;
  seedProgram(profileId: string, input: SeedProgramInput): Promise<Program>;
  listLogs(profileId: string): Promise<WorkoutLog[]>;
  snapshot(): Promise<E2EStateSnapshot>;
}

const MISSING =
  'window.__tytaxE2E is missing: open a page with tytax.gotoApp() first, and serve a dev build or one built with NEXT_PUBLIC_E2E_HOOKS=1';

export function createTytax(page: Page): TytaxFixture {
  const waitReady = async (): Promise<void> => {
    await page.waitForFunction(() => window.__tytaxE2E?.ready === true);
  };

  return {
    async gotoApp(path) {
      await page.goto(path);
      await waitReady();
    },

    async reset() {
      await page.evaluate(async (missing) => {
        const hooks = window.__tytaxE2E;
        if (hooks === undefined) throw new Error(missing);
        await hooks.reset();
      }, MISSING);
      await page.reload();
      await waitReady();
    },

    seedProfile(input) {
      return page.evaluate(
        async ({ input: seed, missing }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          return hooks.seedProfile(seed);
        },
        { input, missing: MISSING },
      );
    },

    seedHistory(profileId, logs) {
      return page.evaluate(
        async ({ profileId: pid, logs: seed, missing }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          return hooks.seedHistory(pid, seed);
        },
        { profileId, logs, missing: MISSING },
      );
    },

    seedProgram(profileId, input) {
      return page.evaluate(
        async ({ profileId: pid, input: seed, missing }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          return hooks.seedProgram(pid, seed);
        },
        { profileId, input, missing: MISSING },
      );
    },

    listLogs(profileId) {
      return page.evaluate(
        async ({ profileId: pid, missing }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          return hooks.listLogs(pid);
        },
        { profileId, missing: MISSING },
      );
    },

    snapshot() {
      return page.evaluate(async (missing) => {
        const hooks = window.__tytaxE2E;
        if (hooks === undefined) throw new Error(missing);
        return hooks.snapshot();
      }, MISSING);
    },
  };
}
