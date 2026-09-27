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
  /** Make `profileId` the device's active profile (repo.profiles.setActive). */
  setActiveProfile(profileId: string): Promise<void>;
  /** Delete a profile and only that profile's data (repo.profiles.remove). */
  removeProfile(profileId: string): Promise<void>;
  /** Every profile (repo.profiles.list). */
  listProfiles(): Promise<Profile[]>;
}

const MISSING =
  'window.__tytaxE2E is missing: open a page with tytax.gotoApp() first, and serve a dev build or one built with NEXT_PUBLIC_E2E_HOOKS=1';
/** The profile hooks are optional in the contract (G5-08); a build without them fails loudly. */
const NO_PROFILE_HOOK = 'window.__tytaxE2E has no profile hook: the served build predates G2-01 (rebuild it)';

/**
 * Wait until the app booted (`__tytaxE2E.ready`). When the boot failed, the
 * app sets `__tytaxE2E.bootError` (src/components/providers/app-bootstrap.tsx)
 * and this throws that error instead of running into the wait timeout.
 */
export async function waitForApp(page: Page): Promise<void> {
  const handle = await page.waitForFunction(() => {
    const hooks = window.__tytaxE2E;
    if (hooks?.bootError !== undefined) return { bootError: hooks.bootError };
    return hooks?.ready === true ? { bootError: null } : false;
  });
  const { bootError } = (await handle.jsonValue()) as { bootError: string | null };
  if (bootError !== null) throw new Error(`TYTAX app bootstrap failed: ${bootError}`);
}

export function createTytax(page: Page): TytaxFixture {
  const waitReady = (): Promise<void> => waitForApp(page);

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

    setActiveProfile(profileId) {
      return page.evaluate(
        async ({ profileId: pid, missing, noHook }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          if (hooks.setActiveProfile === undefined) throw new Error(noHook);
          await hooks.setActiveProfile(pid);
        },
        { profileId, missing: MISSING, noHook: NO_PROFILE_HOOK },
      );
    },

    removeProfile(profileId) {
      return page.evaluate(
        async ({ profileId: pid, missing, noHook }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          if (hooks.removeProfile === undefined) throw new Error(noHook);
          await hooks.removeProfile(pid);
        },
        { profileId, missing: MISSING, noHook: NO_PROFILE_HOOK },
      );
    },

    listProfiles() {
      return page.evaluate(
        async ({ missing, noHook }) => {
          const hooks = window.__tytaxE2E;
          if (hooks === undefined) throw new Error(missing);
          if (hooks.listProfiles === undefined) throw new Error(noHook);
          return hooks.listProfiles();
        },
        { missing: MISSING, noHook: NO_PROFILE_HOOK },
      );
    },
  };
}
