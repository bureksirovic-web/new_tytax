import Dexie from 'dexie';
import type { ArsenalEntry, BodyweightEntry, EquipmentInventory, ExerciseNote, PRRecord, PRType } from '@/contracts/domain';
import { RepoError, type ArsenalRepo, type BodyweightRepo, type EquipmentRepo, type NotesRepo, type PRsRepo } from '@/contracts/repo';
import {
  asc,
  assertDay,
  assertNonEmpty,
  assertPositive,
  byProfile,
  compact,
  desc,
  notFound,
  paginate,
  stripKeys,
  undeleted,
  visible,
  type RepoContext,
} from './context';
import { getLiveProfile } from './profiles';

// ─── PRs ─────────────────────────────────────────────────────────────────────

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

// ─── Bodyweight ──────────────────────────────────────────────────────────────

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

// ─── Exercise notes ──────────────────────────────────────────────────────────

export function createNotesRepo(ctx: RepoContext): NotesRepo {
  const rowsFor = (profileId: string, exerciseId: string): Promise<ExerciseNote[]> =>
    ctx.db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray();

  return {
    async get(profileId, exerciseId) {
      return (await rowsFor(profileId, exerciseId)).find((n) => !n.deletedAt);
    },

    set: (profileId, exerciseId, content) =>
      ctx.write(async (w) => {
        assertNonEmpty(exerciseId, 'exerciseId');
        if (typeof content !== 'string') throw new RepoError('VALIDATION', 'content must be a string');
        const rows = await rowsFor(profileId, exerciseId);
        const live = rows.find((n) => !n.deletedAt);
        const stamp = ctx.stamp();
        if (content.trim() === '') {
          if (live) {
            await ctx.db.exerciseNotes.put({ ...live, deletedAt: stamp, updatedAt: stamp });
            await w.queue('exercise_notes', 'delete', live.id, profileId);
          }
          return undefined;
        }
        await getLiveProfile(ctx, profileId);
        const base = live ?? rows[0];
        const note: ExerciseNote = base
          ? { ...undeleted(base), content, updatedAt: stamp }
          : { id: ctx.newId(), profileId, exerciseId, content, createdAt: stamp, updatedAt: stamp };
        await ctx.db.exerciseNotes.put(note);
        await w.queue('exercise_notes', 'upsert', note.id, profileId);
        return note;
      }),

    async list(profileId, opts) {
      const rows = visible(await byProfile(ctx.db.exerciseNotes, profileId), opts?.includeDeleted);
      rows.sort((a, b) => desc(a.updatedAt, b.updatedAt));
      return paginate(rows, opts);
    },
  };
}

// ─── Arsenal (favourites) ────────────────────────────────────────────────────

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

// ─── Equipment ───────────────────────────────────────────────────────────────

function emptyInventory(profileId: string, stamp: string): EquipmentInventory {
  return { id: profileId, profileId, stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [], createdAt: stamp, updatedAt: stamp };
}

export function createEquipmentRepo(ctx: RepoContext): EquipmentRepo {
  return {
    async get(profileId) {
      const row = await ctx.db.equipment.get(profileId);
      return row && row.profileId === profileId && !row.deletedAt ? row : emptyInventory(profileId, ctx.stamp());
    },

    save: (profileId, patch) =>
      ctx.write(async (w) => {
        await getLiveProfile(ctx, profileId);
        const stamp = ctx.stamp();
        const stored = await ctx.db.equipment.get(profileId);
        const base = stored && stored.profileId === profileId ? undeleted(stored) : emptyInventory(profileId, stamp);
        const next: EquipmentInventory = compact({
          ...base,
          ...compact(stripKeys(patch ?? {}, ['id', 'profileId', 'createdAt', 'deletedAt'])),
          id: profileId,
          profileId,
          createdAt: base.createdAt,
          updatedAt: stamp,
        });
        next.stationIds = [...next.stationIds];
        next.attachmentIds = [...next.attachmentIds];
        next.kettlebellsKg = [...next.kettlebellsKg];
        next.bodyweightGear = [...next.bodyweightGear];
        next.kettlebellsKg.forEach((kg) => assertPositive(kg, 'kettlebellsKg[]'));
        await ctx.db.equipment.put(next);
        await w.queue('equipment', 'upsert', profileId, profileId);
        return next;
      }),
  };
}
