/** Shared helpers for the settings tests: a fresh fake-IndexedDB repository per test and real providers. */
import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import type { WorkoutLog } from '@/contracts/domain';
import type { BackupV3, Repository } from '@/contracts/repo';
import { buildWorkoutLog, sequentialIds, type SeedLogInput } from '@/contracts/fixtures';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { useUIStore } from '@/stores/ui-store';

export const NOW = new Date(2026, 8, 23, 12, 0, 0);
export const BENCH = 'tytax_smith-machine_smith-flat-bench-press';

export interface Holder {
  repo: unknown;
}

let n = 0;
let currentDb: TytaxDatabase | undefined;

/**
 * The raw Dexie database behind the last `installRepo` repository. Writing to
 * it bypasses the repository's validation: it simulates rows stored by an
 * older build, which a current import would rightly reject.
 */
export function rawDb(): TytaxDatabase {
  if (!currentDb) throw new Error('installRepo() first');
  return currentDb;
}

/** Points the mocked `getRepository()` at a brand-new database; resets toasts and storage. */
export function installRepo(holder: Holder): Repository {
  n += 1;
  currentDb = new TytaxDatabase(`settings-test-${n}`);
  const repo = createRepository({ db: currentDb });
  holder.repo = repo;
  window.localStorage.clear();
  useUIStore.setState({ toasts: [] });
  return repo;
}

const ids = sequentialIds('seed');

export function emptyBackup(): BackupV3 {
  return {
    format: 'tytax-backup',
    version: 3,
    exportedAt: NOW.toISOString(),
    profiles: [],
    workoutLogs: [],
    programs: [],
    prRecords: [],
    bodyweightEntries: [],
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  };
}

/** Writes finished logs through the repository's backup import (as the e2e seed hook does). */
export async function seedLogs(repo: Repository, profileId: string, logs: SeedLogInput[]): Promise<WorkoutLog[]> {
  const built = logs.map((l) => buildWorkoutLog(profileId, l, NOW, ids));
  await repo.importBackup({ ...emptyBackup(), workoutLogs: built });
  return built;
}

export const oneSetLog = (daysAgo: number): SeedLogInput => ({
  daysAgo,
  exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }],
});

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <LocaleProvider>{ui}</LocaleProvider>
  </ThemeProvider>
);

/** Renders inside the real theme and locale providers (locale 'en' unless stored); `rerender` keeps them. */
export function renderWithProviders(ui: React.ReactElement) {
  const result = render(wrap(ui));
  return { ...result, rerender: (next: React.ReactElement) => result.rerender(wrap(next)) };
}

export const toastMessages = () => useUIStore.getState().toasts.map((t) => t.message);
