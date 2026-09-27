import type { ArsenalEntry } from '@/contracts/domain';
import type { ArsenalRepo } from '@/contracts/repo';
import type { RepoContext } from './context';
import { getLiveProfile } from './profile-store';
import { byProfile, desc, paginate, undeleted, visible } from './rows';
import { assertNonEmpty } from './validate';

export function createArsenalRepo(ctx: RepoContext): ArsenalRepo {
  const rowsFor = (profileId: string, exerciseId: string): Promise<ArsenalEntry[]> =>
    ctx.db.arsenal.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray();

  return {
    async list(profileId, opts) {
      const rows = visible(await byProfile(ctx.db.arsenal, profileId), opts?.includeDeleted);
      rows.sort((a, b) => desc(a.addedAt, b.addedAt));
      return paginate(rows, opts);
    },

    async has(profileId, exerciseId) {
      return (await rowsFor(profileId, exerciseId)).some((r) => !r.deletedAt);
    },

    add: (profileId, exerciseId) =>
      ctx.write(async (w) => {
        assertNonEmpty(exerciseId, 'exerciseId');
        await getLiveProfile(ctx, profileId);
        const rows = await rowsFor(profileId, exerciseId);
        const live = rows.find((r) => !r.deletedAt);
        if (live) return live;
        const stamp = ctx.stamp();
        const entry: ArsenalEntry = rows[0]
          ? { ...undeleted(rows[0]), addedAt: stamp, updatedAt: stamp }
          : { id: ctx.newId(), profileId, exerciseId, addedAt: stamp, updatedAt: stamp };
        await ctx.db.arsenal.put(entry);
        await w.queue('arsenal', 'upsert', entry.id, profileId);
        return entry;
      }),

    /** Idempotent: removing an exercise that is not in the arsenal is a no-op. */
    remove: (profileId, exerciseId) =>
      ctx.write(async (w) => {
        const stamp = ctx.stamp();
        for (const row of await rowsFor(profileId, exerciseId)) {
          if (row.deletedAt) continue;
          await ctx.db.arsenal.put({ ...row, deletedAt: stamp, updatedAt: stamp });
          await w.queue('arsenal', 'delete', row.id, profileId);
        }
      }),
  };
}
