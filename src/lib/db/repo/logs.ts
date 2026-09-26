import Dexie from 'dexie';
import type { Modality, SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import { RepoError, type DateRange, type ListOptions, type LogsRepo } from '@/contracts/repo';
import {
  assertDay,
  assertNonNegative,
  assertTimestamp,
  compact,
  desc,
  notFound,
  paginate,
  stripKeys,
  undeleted,
  visible,
  type RepoContext,
} from './context';

/** A set that counts as training: done and not a warm-up (contract rule). */
export function countsAsWork(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup';
}

export interface LogTotals {
  totalVolumeKg: number;
  totalSets: number;
  modalitiesUsed: Modality[];
}

export function computeTotals(exercises: readonly SessionExercise[]): LogTotals {
  let totalVolumeKg = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!countsAsWork(s)) continue;
      totalVolumeKg += s.kg * s.reps;
      totalSets += 1;
    }
  }
  return {
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
    totalSets,
    modalitiesUsed: [...new Set(exercises.map((e) => e.modality))],
  };
}

export function validateExercises(exercises: unknown): asserts exercises is SessionExercise[] {
  if (!Array.isArray(exercises)) throw new RepoError('VALIDATION', 'exercises must be an array');
  for (const ex of exercises as SessionExercise[]) {
    if (typeof ex?.exerciseId !== 'string' || ex.exerciseId === '') {
      throw new RepoError('VALIDATION', 'exercise.exerciseId must not be empty');
    }
    if (!Array.isArray(ex.sets)) throw new RepoError('VALIDATION', 'exercise.sets must be an array');
    for (const s of ex.sets) {
      assertNonNegative(s?.kg, 'set.kg');
      assertNonNegative(s?.reps, 'set.reps');
    }
  }
}

/** Newest first: date desc, then startedAt desc. */
export function byNewest(a: WorkoutLog, b: WorkoutLog): number {
  return desc(a.date, b.date) || desc(a.startedAt, b.startedAt) || desc(a.id, b.id);
}

async function ownedLog(ctx: RepoContext, profileId: string, id: string): Promise<WorkoutLog | undefined> {
  const log = await ctx.db.workoutLogs.get(id);
  return log && log.profileId === profileId ? log : undefined;
}

async function rangeRows(ctx: RepoContext, profileId: string, range?: DateRange): Promise<WorkoutLog[]> {
  if (range?.from !== undefined) assertDay(range.from, 'from');
  if (range?.to !== undefined) assertDay(range.to, 'to');
  return ctx.db.workoutLogs
    .where('[profileId+date]')
    .between([profileId, range?.from ?? Dexie.minKey], [profileId, range?.to ?? Dexie.maxKey], true, true)
    .toArray();
}

export function createLogsRepo(ctx: RepoContext): LogsRepo {
  return {
    async list(profileId, opts?: ListOptions & DateRange) {
      const rows = visible(await rangeRows(ctx, profileId, opts), opts?.includeDeleted);
      return paginate(rows.sort(byNewest), opts);
    },

    async get(profileId, id, opts) {
      const log = await ownedLog(ctx, profileId, id);
      if (!log) return undefined;
      return !log.deletedAt || opts?.includeDeleted ? log : undefined;
    },

    update: (profileId, id, patch) =>
      ctx.write(async (w) => {
        const current = await ownedLog(ctx, profileId, id);
        if (!current || current.deletedAt) throw notFound('WorkoutLog', id);
        const clean = stripKeys(patch ?? {}, ['id', 'profileId', 'createdAt', 'deletedAt']);
        if (clean.date !== undefined) assertDay(clean.date, 'date');
        if (clean.startedAt !== undefined) assertTimestamp(clean.startedAt, 'startedAt');
        if (clean.finishedAt !== undefined) assertTimestamp(clean.finishedAt, 'finishedAt');
        if (clean.durationSeconds !== undefined) assertNonNegative(clean.durationSeconds, 'durationSeconds');
        if (clean.bodyweightKg !== undefined) assertNonNegative(clean.bodyweightKg, 'bodyweightKg');
        const next: WorkoutLog = { ...current, ...clean };
        if (clean.exercises !== undefined) {
          validateExercises(clean.exercises);
          Object.assign(next, computeTotals(clean.exercises));
        }
        next.updatedAt = ctx.stamp();
        const stored = compact(next);
        await ctx.db.workoutLogs.put(stored);
        await w.queue('workout_logs', 'upsert', id, profileId);
        return stored;
      }),

    softDelete: (profileId, id) =>
      ctx.write(async (w) => {
        const current = await ownedLog(ctx, profileId, id);
        if (!current) throw notFound('WorkoutLog', id);
        if (current.deletedAt) return;
        const stamp = ctx.stamp();
        await ctx.db.workoutLogs.put({ ...current, deletedAt: stamp, updatedAt: stamp });
        await w.queue('workout_logs', 'delete', id, profileId);
        // PRs set by this workout stop counting while it is deleted.
        const prs = await ctx.db.prRecords.where('workoutLogId').equals(id).toArray();
        for (const pr of prs) {
          if (pr.deletedAt || pr.profileId !== profileId) continue;
          await ctx.db.prRecords.put({ ...pr, deletedAt: stamp, updatedAt: stamp });
          await w.queue('pr_records', 'delete', pr.id, profileId);
        }
      }),

    restore: (profileId, id) =>
      ctx.write(async (w) => {
        const current = await ownedLog(ctx, profileId, id);
        if (!current) throw notFound('WorkoutLog', id);
        if (!current.deletedAt) return;
        const deletedAt = current.deletedAt;
        const stamp = ctx.stamp();
        await ctx.db.workoutLogs.put({ ...undeleted(current), updatedAt: stamp });
        await w.queue('workout_logs', 'upsert', id, profileId);
        // Bring back exactly the PRs the log's soft delete took with it.
        const prs = await ctx.db.prRecords.where('workoutLogId').equals(id).toArray();
        for (const pr of prs) {
          if (pr.deletedAt !== deletedAt || pr.profileId !== profileId) continue;
          await ctx.db.prRecords.put({ ...undeleted(pr), updatedAt: stamp });
          await w.queue('pr_records', 'upsert', pr.id, profileId);
        }
      }),

    async historyFor(profileId, exerciseId, opts) {
      const rows = visible(await rangeRows(ctx, profileId), opts?.includeDeleted);
      const hits = rows.filter((l) => l.exercises.some((e) => e.exerciseId === exerciseId));
      return paginate(hits.sort(byNewest), opts);
    },

    async count(profileId, opts) {
      const coll = ctx.db.workoutLogs.where('profileId').equals(profileId);
      return opts?.includeDeleted ? coll.count() : coll.filter((l) => !l.deletedAt).count();
    },
  };
}
