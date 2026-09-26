import type { PRRecord, PRType } from '@/contracts/domain';
import type { PRsRepo } from '@/contracts/repo';
import type { RepoContext } from './context';
import { asc, byProfile, desc, paginate, visible } from './rows';

/** Best (max value) live record per PR type; ties keep the earliest achieved. */
export function bestPerType(records: readonly PRRecord[]): Partial<Record<PRType, PRRecord>> {
  const best: Partial<Record<PRType, PRRecord>> = {};
  for (const r of records) {
    if (r.deletedAt) continue;
    const cur = best[r.prType];
    if (!cur || r.value > cur.value || (r.value === cur.value && asc(r.achievedAt, cur.achievedAt) < 0)) {
      best[r.prType] = r;
    }
  }
  return best;
}

export function createPRsRepo(ctx: RepoContext): PRsRepo {
  return {
    async list(profileId, opts) {
      const rows = opts?.exerciseId
        ? await ctx.db.prRecords.where('[profileId+exerciseId]').equals([profileId, opts.exerciseId]).toArray()
        : await byProfile(ctx.db.prRecords, profileId);
      const live = visible(rows, opts?.includeDeleted);
      live.sort((a, b) => desc(a.achievedAt, b.achievedAt) || asc(a.prType, b.prType));
      return paginate(live, opts);
    },

    async best(profileId, exerciseId) {
      const rows = await ctx.db.prRecords.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray();
      return bestPerType(rows);
    },
  };
}
