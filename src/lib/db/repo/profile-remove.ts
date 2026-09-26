/**
 * `ProfilesRepo.remove`: wipes every row the profile owns in every table.
 * Sync off: rows, the profile and its outbox rows are hard-deleted.
 * Sync on: live rows and the profile are tombstoned and delete ops queued.
 * Never reads or writes another profile's rows. When the removed profile was
 * active, the oldest remaining live profile becomes active (or none).
 */
import type { RepoContext, WriteScope } from './context';
import { firstLiveProfile, getLiveProfile, readActiveId, writeActiveId } from './profile-store';
import { byProfile } from './rows';
import { OWNED_TABLES, dataTable } from './tables';

export async function removeProfile(ctx: RepoContext, w: WriteScope, id: string): Promise<void> {
  const profile = await getLiveProfile(ctx, id);
  const soft = ctx.sync.enabled;
  const stamp = ctx.stamp();
  for (const [name, syncName] of OWNED_TABLES) {
    const table = dataTable(ctx.db, name);
    const rows = (await byProfile(table, id)).filter((r) => r.profileId === id);
    if (!soft) {
      await table.bulkDelete(rows.map((r) => r.id));
      continue;
    }
    for (const row of rows) {
      if (row.deletedAt) continue;
      await table.put({ ...row, deletedAt: stamp, updatedAt: stamp });
      await w.queue(syncName, 'delete', row.id, id);
    }
  }
  if (soft) {
    await ctx.db.profiles.put({ ...profile, deletedAt: stamp, updatedAt: stamp });
    await w.queue('profiles', 'delete', id, id);
  } else {
    await ctx.db.profiles.delete(id);
    const stale = await ctx.db.syncQueue.filter((op) => op.profileId === id).primaryKeys();
    await ctx.db.syncQueue.bulkDelete(stale);
  }
  if ((await readActiveId(ctx)) === id) {
    const next = await firstLiveProfile(ctx);
    await writeActiveId(ctx, next?.id ?? null);
  }
}
