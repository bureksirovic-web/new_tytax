/**
 * Bulk data movement: JSON backup export/import, outbox, and the test-only
 * wipe. Remote LWW apply lives in ./apply-remote.
 *
 * importBackup (G2): one rw transaction; every check runs before the first
 * write (./import-plan) and any throw rolls back all rows. Idempotent by
 * record id, outbox included: rows identical to the local copy are neither
 * rewritten, queued nor counted. Device meta (active-profile pointer) is
 * never written; the caller decides. Deep field validation is
 * `parseBackupV3`'s job (src/lib/import); this trusted-caller path checks
 * shape. Outbox rows only for rows written.
 *
 * PR re-derivation (G3-02): every profile with a written workout log or PR
 * row gets `rebuildPRsFrom(.., { orphans: true })` in the SAME transaction,
 * so prRecords, set isPR/e1rm and prCount reflect the whole live history
 * (the first real PR after a restore/legacy import is not a baseline). Its
 * writes are derived rows: queued, but not in the returned counts (those
 * describe backup rows). A re-import that writes nothing rebuilds nothing.
 * applyRemote never rebuilds: the server is authoritative for pulled rows.
 */
import { RepoError, type BackupV3 } from '@/contracts/repo';
import type { SyncOperation, SyncOutbox } from '@/contracts/sync';
import type { RepoContext } from './context';
import { planImport, validateBackup } from './import-plan';
import { loadRowProblem } from './row-check-lazy';
import { rebuildPRsFrom } from './prs';
import { dataTable } from './tables';

export { applyRemote } from './apply-remote';

export async function exportBackup(ctx: RepoContext, profileId?: string): Promise<BackupV3> {
  const db = ctx.db;
  return db.transaction('r', db.tables, async () => {
    let profiles = await db.profiles.toArray();
    if (profileId !== undefined) {
      profiles = profiles.filter((p) => p.id === profileId);
      if (profiles.length === 0) throw new RepoError('NOT_FOUND', `Profile ${profileId} not found`);
    }
    const rows = <T>(t: ProfileScoped<T>): Promise<T[]> =>
      profileId === undefined ? t.toArray() : t.where('profileId').equals(profileId).toArray();
    return {
      format: 'tytax-backup',
      version: 3,
      exportedAt: ctx.stamp(),
      profiles,
      workoutLogs: await rows(db.workoutLogs),
      programs: await rows(db.programs),
      prRecords: await rows(db.prRecords),
      bodyweightEntries: await rows(db.bodyweightEntries),
      exerciseNotes: await rows(db.exerciseNotes),
      arsenal: await rows(db.arsenal),
      equipment: await rows(db.equipment),
    };
  });
}

interface ProfileScoped<T> {
  toArray(): Promise<T[]>;
  where(index: string): { equals(key: string): { toArray(): Promise<T[]> } };
}

export async function importBackup(ctx: RepoContext, backup: BackupV3): Promise<{ inserted: number; updated: number }> {
  // Lazy (zod stays out of first-load JS); safe inside a caller's transaction: see row-check-lazy.ts.
  validateBackup(backup, await loadRowProblem());
  return ctx.write(async (w) => {
    const plans = await planImport(ctx, backup);
    let inserted = 0;
    let updated = 0;
    const touched = new Set<string>();
    for (const plan of plans) {
      if (plan.write.length === 0) continue;
      if (plan.name === 'workoutLogs' || plan.name === 'prRecords') for (const r of plan.write) touched.add(String(r.profileId));
      await dataTable(ctx.db, plan.name).bulkPut(plan.write);
      inserted += plan.inserted;
      // File rows only: local losers tombstoned by the natural-key rule are neither (import-plan.ts).
      updated += plan.fromFile - plan.inserted;
      // One outbox request per table, never one await per row (see WriteScope.queueMany).
      await w.queueMany(plan.write.map((r) => ({ table: plan.syncName, op: 'upsert' as const, recordId: r.id, profileId: plan.isProfiles ? r.id : String(r.profileId) })));
    }
    // Sorted: deterministic outbox order across runs.
    for (const profileId of [...touched].sort()) await rebuildPRsFrom(ctx, w, profileId, { orphans: true });
    return { inserted, updated };
  });
}

export function createOutbox(ctx: RepoContext): SyncOutbox {
  return {
    peek: (limit) => ctx.db.syncQueue.orderBy('createdAt').limit(Math.max(0, Math.floor(limit))).toArray(),
    ack: async (ids) => void (await ctx.db.syncQueue.bulkDelete([...ids])),
    async fail(id, error) {
      await ctx.db.syncQueue.where('id').equals(id).modify((op: SyncOperation) => {
        op.retryCount = (op.retryCount ?? 0) + 1;
        op.lastError = error;
      });
    },
    count: () => ctx.db.syncQueue.count(),
  };
}

export async function resetAll(ctx: RepoContext): Promise<void> {
  await ctx.write(async () => {
    for (const table of ctx.db.tables) await table.clear();
  });
}
