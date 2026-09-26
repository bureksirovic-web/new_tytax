import Dexie from 'dexie';
import type { Modality, SessionExercise, WorkoutLog } from '@/contracts/domain';
import { RepoError, type DateRange, type ListOptions, type LogsRepo } from '@/contracts/repo';
import {
  assertDay,
  assertDurationSeconds,
  assertNonNegative,
  assertTimestamp,
  chrono,
  compact,
  desc,
  isTimeSet,
  laterStamp,
  notFound,
  paginate,
  stripKeys,
  undeleted,
  visible,
  type RepoContext,
} from './context';
import { countsAsWork, rebuildPRsFrom } from './prs';

export { countsAsWork };

export interface LogTotals {
  totalVolumeKg: number;
  totalSets: number;
  modalitiesUsed: Modality[];
}

/**
 * Totals over counting sets (done, not warm-up). A time set (`durationSeconds`
 * present) counts in totalSets but adds no kg volume: its kg x reps is not work.
 */
export function computeTotals(exercises: readonly SessionExercise[]): LogTotals {
  let totalVolumeKg = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!countsAsWork(s)) continue;
      if (!isTimeSet(s)) totalVolumeKg += s.kg * s.reps;
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
  // Duplicate uids / set ids would make isPR (keyed uid::setId) flag every set sharing a PR set's id.
  const uids = new Set<string>();
  for (const ex of exercises as SessionExercise[]) {
    if (typeof ex?.exerciseId !== 'string' || ex.exerciseId === '') {
      throw new RepoError('VALIDATION', 'exercise.exerciseId must not be empty');
    }
    if (!Array.isArray(ex.sets)) throw new RepoError('VALIDATION', 'exercise.sets must be an array');
    if (uids.has(ex.uid)) throw new RepoError('VALIDATION', `exercise.uid ${ex.uid} is not unique`);
    uids.add(ex.uid);
    const ids = new Set<string>();
    for (const s of ex.sets) {
      if (ids.has(s?.id)) throw new RepoError('VALIDATION', `set.id ${s.id} is not unique within its exercise`);
      ids.add(s?.id);
      assertNonNegative(s?.kg, 'set.kg');
      assertNonNegative(s?.reps, 'set.reps');
      if (s.durationSeconds !== undefined) assertDurationSeconds(s.durationSeconds, 'set.durationSeconds');
    }
  }
}

const SERVER_OWNED = ['id', 'profileId', 'createdAt', 'updatedAt', 'deletedAt', 'totalVolumeKg', 'totalSets', 'modalitiesUsed', 'prCount'] as const;

export function assertRpe(v: unknown, field: string): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 10) throw new RepoError('VALIDATION', `${field} must be 1-10`);
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
        // Totals, prCount and bookkeeping are server-owned: never taken from the patch.
        const clean = stripKeys(patch ?? {}, SERVER_OWNED);
        if (clean.date !== undefined) assertDay(clean.date, 'date');
        if (clean.startedAt !== undefined) assertTimestamp(clean.startedAt, 'startedAt');
        if (clean.finishedAt !== undefined) assertTimestamp(clean.finishedAt, 'finishedAt');
        if (clean.durationSeconds !== undefined) assertNonNegative(clean.durationSeconds, 'durationSeconds');
        if (clean.bodyweightKg !== undefined) assertNonNegative(clean.bodyweightKg, 'bodyweightKg');
        if (clean.rpe !== undefined) assertRpe(clean.rpe, 'rpe');
        if (clean.exercises !== undefined) validateExercises(clean.exercises);
        const next: WorkoutLog = { ...current, ...clean, ...computeTotals(clean.exercises ?? current.exercises), updatedAt: laterStamp(ctx.stamp(), current.updatedAt) };
        // finishedAt feeds PR rows' achievedAt (sets without completedAt), so it takes the rebuild path too.
        if (clean.exercises === undefined && clean.date === undefined && clean.startedAt === undefined && clean.finishedAt === undefined) {
          const stored = compact(next);
          await ctx.db.workoutLogs.put(stored);
          await w.queue('workout_logs', 'upsert', id, profileId);
          return stored;
        }
        // G4-26/G4-47: sets, prCount and PR rows of this log and every later live log follow the edit.
        const from = chrono(current, next) <= 0 ? current : next;
        const { logs } = await rebuildPRsFrom(ctx, w, profileId, { from, pending: next });
        return logs.get(id) ?? compact(next);
      }),

    softDelete: (profileId, id) =>
      ctx.write(async (w) => {
        const current = await ownedLog(ctx, profileId, id);
        if (!current) throw notFound('WorkoutLog', id);
        if (current.deletedAt) return;
        const stamp = ctx.stamp();
        await ctx.db.workoutLogs.put({ ...current, deletedAt: stamp, updatedAt: laterStamp(stamp, current.updatedAt) });
        await w.queue('workout_logs', 'delete', id, profileId);
        // PRs set by this workout stop counting while it is deleted.
        const prs = await ctx.db.prRecords.where('workoutLogId').equals(id).toArray();
        for (const pr of prs) {
          if (pr.deletedAt || pr.profileId !== profileId) continue;
          await ctx.db.prRecords.put({ ...pr, deletedAt: stamp, updatedAt: laterStamp(stamp, pr.updatedAt) });
          await w.queue('pr_records', 'delete', pr.id, profileId);
        }
        // A deleted PR log lets the next log take the PR: re-derive everything after it.
        await rebuildPRsFrom(ctx, w, profileId, { from: current });
      }),

    restore: (profileId, id) =>
      ctx.write(async (w) => {
        const current = await ownedLog(ctx, profileId, id);
        if (!current) throw notFound('WorkoutLog', id);
        if (!current.deletedAt) return;
        const deletedAt = current.deletedAt;
        const stamp = ctx.stamp();
        await ctx.db.workoutLogs.put({ ...undeleted(current), updatedAt: laterStamp(stamp, current.updatedAt) });
        await w.queue('workout_logs', 'upsert', id, profileId);
        // Bring back exactly the PRs the log's soft delete took with it.
        const prs = await ctx.db.prRecords.where('workoutLogId').equals(id).toArray();
        for (const pr of prs) {
          if (pr.deletedAt !== deletedAt || pr.profileId !== profileId) continue;
          await ctx.db.prRecords.put({ ...undeleted(pr), updatedAt: laterStamp(stamp, pr.updatedAt) });
          await w.queue('pr_records', 'upsert', pr.id, profileId);
        }
        // Revival above only reuses row ids: history before the log may have changed while it was
        // deleted, so the log itself and every later log are re-derived.
        await rebuildPRsFrom(ctx, w, profileId, { from: current });
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
