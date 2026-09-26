/**
 * PR records: the read repo plus the PR bookkeeping of finishWorkout, logs
 * and import. Detection compares against the profile's live logs (R01), never
 * stored PR rows; an edit re-derives every later live log too (G4-26/G4-47).
 */
import type { PRRecord, WorkoutLog } from '@/contracts/domain';
import type { PRsRepo } from '@/contracts/repo';
import type { PRCandidate } from '@/contracts/training';
import type { RepoContext, WriteScope } from './context';
import { absorb, annotate, asc, bestPerType, byProfile, chrono, compact, desc, detectRepoPRs, laterStamp, paginate, sameAnnotations, setKey, upsertRows, visible, type Bests } from './rows';

export { annotate, bestPerType, bestsFromLogs, countsAsWork, detectRepoPRs, E1RM_MAX_REPS, isTimeSet, setKey, storedE1rm } from './rows';

/** Live logs of a profile, one read over the [profileId] index. */
export async function liveLogsOf(ctx: RepoContext, profileId: string): Promise<WorkoutLog[]> {
  return ctx.db.workoutLogs.where('profileId').equals(profileId).filter((l) => !l.deletedAt).toArray();
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

/** PR rows written by a rebuild. */
export type RebuildCounts = { inserted: number; updated: number; tombstoned: number };

/**
 * `from`: re-derive logs at (`after`: strictly after) its chronological position (a deleted log still marks one).
 * `pending`: unsaved new version of a log (logs.update), replaces the stored one, always written.
 * `orphans`: also tombstone live PR rows whose log is not live (full rebuild).
 */
export type RebuildOptions = { from?: WorkoutLog; after?: boolean; pending?: WorkoutLog; orphans?: boolean };

/**
 * Re-derives set e1rm/isPR, prCount and PR rows of the profile's live logs
 * from `from` on, with finishWorkout's rules (first-ever values are stored
 * baselines, never counted). Writes and queues changed rows only. Run it
 * inside `ctx.write`. Returns the PR-row counts and every log it wrote.
 */
export async function rebuildPRsFrom(ctx: RepoContext, w: WriteScope, profileId: string, opts: RebuildOptions = {}): Promise<RebuildCounts & { logs: Map<string, WorkoutLog> }> {
  const { from, pending } = opts;
  const stamp = ctx.stamp();
  let logs = (await liveLogsOf(ctx, profileId)).filter((l) => l.id !== pending?.id && Array.isArray(l.exercises));
  if (pending && !pending.deletedAt) logs.push(pending);
  logs = logs.sort(chrono);
  const rowsByLog = new Map<string, PRRecord[]>();
  for (const r of await byProfile(ctx.db.prRecords, profileId)) if (!r.deletedAt) rowsByLog.set(r.workoutLogId, [...(rowsByLog.get(r.workoutLogId) ?? []), r]);
  const out = { inserted: 0, updated: 0, tombstoned: 0, logs: new Map<string, WorkoutLog>() };
  const [prWrites, bests]: [PRRecord[], Bests] = [[], Object.create(null)];
  for (const log of logs) {
    const candidates = detectRepoPRs(log.exercises, bests);
    absorb(bests, candidates);
    if (from && chrono(log, from) < (opts.after ? 1 : 0)) continue;
    const celebrated = candidates.filter((c) => !c.isBaseline);
    const exercises = annotate(log.exercises, celebrated);
    let next = log;
    if (log === pending || log.prCount !== celebrated.length || !sameAnnotations(log.exercises, exercises)) {
      next = compact({ ...log, exercises, prCount: celebrated.length, updatedAt: log === pending ? log.updatedAt : laterStamp(stamp, log.updatedAt) });
      out.logs.set(log.id, next);
    }
    const wanted = new Map(recordsFor(ctx, next, candidates, stamp).map((r) => [`${r.exerciseId}|${r.prType}`, r]));
    for (const r of rowsByLog.get(log.id) ?? []) {
      const key = `${r.exerciseId}|${r.prType}`;
      const want = wanted.get(key);
      wanted.delete(key);
      if (!want) {
        out.tombstoned += 1;
        prWrites.push({ ...r, deletedAt: stamp, updatedAt: laterStamp(stamp, r.updatedAt) });
      } else if (want.value !== r.value || want.kg !== r.kg || want.reps !== r.reps || want.setId !== r.setId || want.achievedAt !== r.achievedAt || want.exerciseName !== r.exerciseName) {
        out.updated += 1;
        prWrites.push({ ...want, id: r.id, createdAt: r.createdAt, updatedAt: laterStamp(stamp, r.updatedAt) });
      }
    }
    out.inserted += wanted.size;
    prWrites.push(...wanted.values());
  }
  if (opts.orphans) {
    const live = new Set(logs.map((l) => l.id));
    const dead = [...rowsByLog].filter(([logId]) => !live.has(logId)).flatMap(([, rows]) => rows);
    out.tombstoned += dead.length;
    prWrites.push(...dead.map((r) => ({ ...r, deletedAt: stamp, updatedAt: laterStamp(stamp, r.updatedAt) })));
  }
  await upsertRows(ctx.db.workoutLogs, [...out.logs.values()]);
  await upsertRows(ctx.db.prRecords, prWrites);
  await w.queueMany([
    ...[...out.logs.keys()].map((id) => ({ table: 'workout_logs' as const, op: 'upsert' as const, recordId: id, profileId })),
    ...prWrites.map((r) => ({ table: 'pr_records' as const, op: r.deletedAt ? ('delete' as const) : ('upsert' as const), recordId: r.id, profileId })),
  ]);
  return out;
}

/**
 * Full PR recompute of one profile from all of its live logs, for import and
 * restore: re-annotates every live log, rewrites its PR rows and tombstones
 * live PR rows of deleted or missing logs. Joins the caller's transaction
 * (or opens one). Returns PR-row counts.
 */
export async function rebuildAllPRs(ctx: RepoContext, profileId: string): Promise<RebuildCounts> {
  return ctx.write(async (w) => {
    const { inserted, updated, tombstoned } = await rebuildPRsFrom(ctx, w, profileId, { orphans: true });
    return { inserted, updated, tombstoned };
  });
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
