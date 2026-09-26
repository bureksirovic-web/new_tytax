import Dexie from 'dexie';
import type { BodyweightEntry } from '@/contracts/domain';
import type { BodyweightRepo } from '@/contracts/repo';
import type { RepoContext } from './context';
import { getLiveProfile } from './profile-store';
import { desc, paginate, visible } from './rows';
import { assertDay, assertPositive, notFound } from './validate';

export function createBodyweightRepo(ctx: RepoContext): BodyweightRepo {
  async function owned(profileId: string, id: string): Promise<BodyweightEntry> {
    const row = await ctx.db.bodyweightEntries.get(id);
    if (!row || row.profileId !== profileId || row.deletedAt) throw notFound('BodyweightEntry', id);
    return row;
  }

  return {
    async list(profileId, opts) {
      if (opts?.from !== undefined) assertDay(opts.from, 'from');
      if (opts?.to !== undefined) assertDay(opts.to, 'to');
      const rows = await ctx.db.bodyweightEntries
        .where('[profileId+date]')
        .between([profileId, opts?.from ?? Dexie.minKey], [profileId, opts?.to ?? Dexie.maxKey], true, true)
        .toArray();
      const live = visible(rows, opts?.includeDeleted);
      live.sort((a, b) => desc(a.date, b.date) || desc(a.createdAt, b.createdAt));
      return paginate(live, opts);
    },

    add: (profileId, input) =>
      ctx.write(async (w) => {
        await getLiveProfile(ctx, profileId);
        assertDay(input?.date, 'date');
        assertPositive(input.valueKg, 'valueKg');
        const stamp = ctx.stamp();
        const row: BodyweightEntry = { id: ctx.newId(), profileId, date: input.date, valueKg: input.valueKg, createdAt: stamp, updatedAt: stamp };
        await ctx.db.bodyweightEntries.add(row);
        await w.queue('bodyweight_entries', 'upsert', row.id, profileId);
        return row;
      }),

    update: (profileId, id, patch) =>
      ctx.write(async (w) => {
        const current = await owned(profileId, id);
        patch = patch ?? {};
        if (patch.date !== undefined) assertDay(patch.date, 'date');
        if (patch.valueKg !== undefined) assertPositive(patch.valueKg, 'valueKg');
        const next: BodyweightEntry = {
          ...current,
          date: patch.date ?? current.date,
          valueKg: patch.valueKg ?? current.valueKg,
          updatedAt: ctx.stamp(),
        };
        await ctx.db.bodyweightEntries.put(next);
        await w.queue('bodyweight_entries', 'upsert', id, profileId);
        return next;
      }),

    softDelete: (profileId, id) =>
      ctx.write(async (w) => {
        const row = await ctx.db.bodyweightEntries.get(id);
        if (!row || row.profileId !== profileId) throw notFound('BodyweightEntry', id);
        if (row.deletedAt) return;
        const stamp = ctx.stamp();
        await ctx.db.bodyweightEntries.put({ ...row, deletedAt: stamp, updatedAt: stamp });
        await w.queue('bodyweight_entries', 'delete', id, profileId);
      }),
  };
}
