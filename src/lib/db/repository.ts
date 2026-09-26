/**
 * Dexie implementation of the frozen `Repository` contract
 * (src/contracts/repo.ts). UI, stores and hooks reach it through
 * `getRepository()` (src/lib/db/index.ts) and src/hooks/use-repo.ts.
 *
 * Every async method maps IndexedDB failures (quota, constraint, closed
 * database) to `RepoError('STORAGE')`, reads included.
 */
import { liveQuery } from 'dexie';
import type { Repository } from '@/contracts/repo';
import { noopSyncAdapter, type SyncAdapter } from '@/contracts/sync';
import { getDb, type TytaxDatabase } from './dexie';
import { newUuid } from './ids';
import { createContext } from './repo/context';
import { guardMethods, wrapStorage } from './repo/errors';
import { finishWorkout } from './repo/finish';
import { createLogsRepo } from './repo/logs';
import { createProfilesRepo } from './repo/profiles';
import { createProgramsRepo } from './repo/programs';
import { createArsenalRepo, createBodyweightRepo, createEquipmentRepo, createNotesRepo, createPRsRepo } from './repo/records';
import { applyRemote, createOutbox, exportBackup, importBackup, resetAll } from './repo/transfer';

export { requireActiveProfile } from './repo/active';

export interface CreateRepositoryOptions {
  /** Database to use; default the lazily constructed app database (`getDb()`). */
  db?: TytaxDatabase;
  /** Default `noopSyncAdapter` (nothing queued). */
  sync?: SyncAdapter;
  now?: () => Date;
  newId?: () => string;
}

export function createRepository(opts: CreateRepositoryOptions = {}): Repository {
  const ctx = createContext({
    db: () => opts.db ?? getDb(),
    sync: () => opts.sync ?? noopSyncAdapter,
    now: opts.now ?? (() => new Date()),
    newId: opts.newId ?? newUuid,
  });

  return {
    profiles: guardMethods(createProfilesRepo(ctx)),
    logs: guardMethods(createLogsRepo(ctx)),
    programs: guardMethods(createProgramsRepo(ctx)),
    prs: guardMethods(createPRsRepo(ctx)),
    bodyweight: guardMethods(createBodyweightRepo(ctx)),
    notes: guardMethods(createNotesRepo(ctx)),
    arsenal: guardMethods(createArsenalRepo(ctx)),
    equipment: guardMethods(createEquipmentRepo(ctx)),
    outbox: guardMethods(createOutbox(ctx)),

    finishWorkout: (draft, debrief) => finishWorkout(ctx, draft, debrief),

    transaction: (fn) => ctx.transaction(fn),

    watch(query, onNext, onError) {
      // An async querier makes Dexie track reads across native awaits inside `query`.
      const subscription = liveQuery(async () => query()).subscribe({
        next: onNext,
        error: (e: unknown) => onError?.(e),
      });
      return () => subscription.unsubscribe();
    },

    exportBackup: (profileId) => wrapStorage(() => exportBackup(ctx, profileId)),
    importBackup: (backup) => importBackup(ctx, backup),
    applyRemote: (table, records) => applyRemote(ctx, table, records),
    resetAll: () => resetAll(ctx),
  };
}
