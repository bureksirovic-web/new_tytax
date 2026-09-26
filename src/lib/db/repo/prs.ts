/**
 * PR records: the read repo plus the shared PR bookkeeping of finishWorkout
 * and logs.update. Detection compares against the profile's live workout logs
 * (R01): stored PR rows are an audit trail, never the comparison base, so log
 * edits, deletes and history written without PR rows (seedHistory,
 * importBackup, migration) keep detection correct.
 */
import type { PRRecord, PRType, SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import type { PRsRepo } from '@/contracts/repo';
import type { ExistingBests, PRCandidate } from '@/contracts/training';
import { training } from '@/lib/training';
import type { RepoContext, WriteScope } from './context';
import { asc, byProfile, desc, paginate, visible } from './rows';

/** A set that counts as training: done and not a warm-up (contract rule). */
export function countsAsWork(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup';
}

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

/** Live logs of a profile, one read over the [profileId] index. */
export async function liveLogsOf(ctx: RepoContext, profileId: string): Promise<WorkoutLog[]> {
  return ctx.db.workoutLogs.where('profileId').equals(profileId).filter((l) => !l.deletedAt).toArray();
}

/**
 * Best value per (exercise, PR type) over `logs`, measured exactly the way
 * detectPRs measures a workout (same set rule, same rounding): each log's
 * own maxima are its detectPRs result against no prior bests.
 */
export function bestsFromLogs(logs: readonly WorkoutLog[]): ExistingBests {
  const bests: Record<string, Partial<Record<PRType, number>>> = Object.create(null);
  for (const log of logs) {
    if (log.deletedAt || !Array.isArray(log.exercises)) continue;
    for (const c of training.detectPRs(log.exercises, bests)) {
      (bests[c.exerciseId] ??= {})[c.prType] = c.value;
    }
  }
  return bests;
}

export const setKey = (uid: string, setId: string): string => `${uid}::${setId}`;

/** Stored exercises: e1RM on every counting set, isPR on sets that set a non-baseline PR. */
export function annotate(exercises: readonly SessionExercise[], celebrated: readonly PRCandidate[]): SessionExercise[] {
  const prSets = new Set(celebrated.map((c) => setKey(c.sessionExerciseUid, c.setId)));
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => {
      const set = { ...s };
      delete set.isPR;
      delete set.e1rm;
      if (!countsAsWork(s)) return set;
      set.e1rm = training.e1rm(s.kg, s.reps);
      if (prSets.has(setKey(ex.uid, s.id))) set.isPR = true;
      return set;
    }),
  }));
}

/** PR rows for `candidates` of `log` (ids and stamps are the caller's). */
export function recordsFor(ctx: RepoContext, log: WorkoutLog, candidates: readonly PRCandidate[], stamp: string): PRRecord[] {
  const setTimes = new Map<string, string | undefined>();
  for (const ex of log.exercises) for (const s of ex.sets) setTimes.set(setKey(ex.uid, s.id), s.completedAt);
  return candidates.map((c) => ({
    id: ctx.newId(),
    profileId: log.profileId,
    exerciseId: c.exerciseId,
    exerciseName: c.exerciseName,
    prType: c.prType,
    value: c.value,
    kg: c.kg,
    reps: c.reps,
    achievedAt: setTimes.get(setKey(c.sessionExerciseUid, c.setId)) ?? log.finishedAt,
    workoutLogId: log.id,
    setId: c.setId,
    createdAt: stamp,
    updatedAt: stamp,
  }));
}

const before = (a: WorkoutLog, b: WorkoutLog): boolean => asc(a.startedAt, b.startedAt) < 0 || (a.startedAt === b.startedAt && a.id < b.id);

/**
 * Re-derives an edited log's PRs against the live logs that started before it:
 * re-annotates its sets and prCount, updates its live PR rows in place,
 * tombstones the ones that no longer hold and inserts new ones. Returns the log.
 */
export async function reconcileLogPRs(ctx: RepoContext, w: WriteScope, log: WorkoutLog): Promise<WorkoutLog> {
  const earlier = (await liveLogsOf(ctx, log.profileId)).filter((l) => l.id !== log.id && before(l, log));
  const candidates = training.detectPRs(log.exercises, bestsFromLogs(earlier));
  const celebrated = candidates.filter((c) => !c.isBaseline);
  const next: WorkoutLog = { ...log, exercises: annotate(log.exercises, celebrated), prCount: celebrated.length };
  const stamp = log.updatedAt;
  const wanted = new Map(recordsFor(ctx, next, candidates, stamp).map((r) => [`${r.exerciseId}|${r.prType}`, r]));
  const stored = await ctx.db.prRecords.where('workoutLogId').equals(log.id).toArray();
  const writes: PRRecord[] = [];
  for (const r of stored) {
    if (r.deletedAt || r.profileId !== log.profileId) continue;
    const key = `${r.exerciseId}|${r.prType}`;
    const want = wanted.get(key);
    wanted.delete(key);
    if (!want) writes.push({ ...r, deletedAt: stamp, updatedAt: stamp });
    else if (want.value !== r.value || want.kg !== r.kg || want.reps !== r.reps || want.setId !== r.setId || want.achievedAt !== r.achievedAt) {
      writes.push({ ...want, id: r.id, createdAt: r.createdAt });
    }
  }
  writes.push(...wanted.values());
  if (writes.length > 0) await ctx.db.prRecords.bulkPut(writes);
  await w.queueMany(writes.map((r) => ({ table: 'pr_records' as const, op: r.deletedAt ? ('delete' as const) : ('upsert' as const), recordId: r.id, profileId: log.profileId })));
  return next;
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
