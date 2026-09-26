/**
 * Chronological PR recompute for one profile after a legacy import.
 *
 * Decisions:
 * - History = every live (not soft-deleted) log of the profile, existing and
 *   newly imported, sorted by startedAt then id. Walked oldest first with
 *   training.detectPRs; bests start empty, so the first value per
 *   (exercise, type) is a baseline record (per the training contract).
 * - Desired records are keyed (workoutLogId, exerciseId, prType). Stored live
 *   e1rm/weight records of live logs are reconciled against that set:
 *   identical -> untouched; different values -> updated in place (keeps its
 *   id); no longer a PR -> soft-deleted; missing -> inserted with a
 *   deterministic uuid v5 id (idempotent). Records of other types or of
 *   soft-deleted logs are left alone.
 * - Every written record is stamped strictly after the row it replaces
 *   (max(import stamp, stored.updatedAt + 1 ms)). importBackup is LWW on
 *   updatedAt, so a device clock behind a stored or synced PR row would
 *   otherwise have its updates/tombstones silently dropped while the counts
 *   claimed them. This also covers re-inserting a desired record whose
 *   deterministic id is a soft-deleted row (counted as updated).
 * - Newly imported logs get the finishWorkout annotations (e1rm on counting
 *   sets, isPR on non-baseline PR sets, prCount). Existing logs keep their
 *   finish-time flags: rewriting a user's finished workouts is out of scope.
 */
import type { PRRecord, PRType, SessionExercise, WorkoutLog } from '@/contracts';
import { training } from '@/lib/training';
import { countsTowardTotals } from '../map/logs';
import { LEGACY_IMPORT_NAMESPACE, uuidV5 } from '../map/uuid';
import type { ImportCounts } from './types';

export interface PrPlan {
  /** The new logs, annotated. */
  logs: WorkoutLog[];
  /** PR rows to write (inserts, updates, tombstones). */
  records: PRRecord[];
  counts: ImportCounts;
}

const RECOMPUTED_TYPES: ReadonlySet<PRType> = new Set(['e1rm', 'weight']);

function byTime(a: WorkoutLog, b: WorkoutLog): number {
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const keyOf = (logId: string, exerciseId: string, prType: string): string => `${logId}|${exerciseId}|${prType}`;

function annotate(exercises: readonly SessionExercise[], prSets: ReadonlySet<string>): SessionExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => {
      const set = { ...s };
      delete set.isPR;
      delete set.e1rm;
      if (!countsTowardTotals(s)) return set;
      set.e1rm = training.e1rm(s.kg, s.reps);
      if (prSets.has(`${ex.uid}::${s.id}`)) set.isPR = true;
      return set;
    }),
  }));
}

function desiredRecords(profileId: string, history: readonly WorkoutLog[], newIds: ReadonlySet<string>, stamp: string) {
  const bests: Record<string, Partial<Record<PRType, number>>> = Object.create(null);
  const desired = new Map<string, PRRecord>();
  const logs: WorkoutLog[] = [];
  for (const log of history) {
    const found = training.detectPRs(log.exercises, bests);
    const setTimes = new Map<string, string | undefined>();
    for (const ex of log.exercises) for (const s of ex.sets) setTimes.set(`${ex.uid}::${s.id}`, s.completedAt);
    for (const c of found) {
      (bests[c.exerciseId] ??= {})[c.prType] = c.value;
      const key = keyOf(log.id, c.exerciseId, c.prType);
      desired.set(key, {
        id: uuidV5(`${profileId}|pr|${key}`, LEGACY_IMPORT_NAMESPACE),
        profileId,
        exerciseId: c.exerciseId,
        exerciseName: c.exerciseName,
        prType: c.prType,
        value: c.value,
        kg: c.kg,
        reps: c.reps,
        achievedAt: setTimes.get(`${c.sessionExerciseUid}::${c.setId}`) ?? log.finishedAt,
        workoutLogId: log.id,
        setId: c.setId,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    if (!newIds.has(log.id)) continue;
    const celebrated = found.filter((c) => !c.isBaseline);
    const prSets = new Set(celebrated.map((c) => `${c.sessionExerciseUid}::${c.setId}`));
    logs.push({ ...log, exercises: annotate(log.exercises, prSets), prCount: celebrated.length });
  }
  return { desired, logs };
}

/** `stamp`, or 1 ms after `prev` when the stored row is not older than the stamp (LWW must accept the write). */
export function stampAfter(stamp: string, prev: string | undefined): string {
  const prevMs = prev === undefined ? Number.NaN : Date.parse(prev);
  if (!Number.isFinite(prevMs) || Date.parse(stamp) > prevMs) return stamp;
  return new Date(prevMs + 1).toISOString();
}

function sameValues(a: PRRecord, b: PRRecord): boolean {
  return a.value === b.value && a.kg === b.kg && a.reps === b.reps && a.setId === b.setId;
}

export function planPRs(
  profileId: string,
  existingLogs: readonly WorkoutLog[],
  newLogs: readonly WorkoutLog[],
  storedPRs: readonly PRRecord[],
  stamp: string,
): PrPlan {
  const history = [...existingLogs, ...newLogs].filter((l) => !l.deletedAt).sort(byTime);
  const liveLogIds = new Set(history.map((l) => l.id));
  const { desired, logs } = desiredRecords(profileId, history, new Set(newLogs.map((l) => l.id)), stamp);
  const counts: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };
  const records: PRRecord[] = [];
  for (const stored of storedPRs) {
    if (stored.deletedAt || !RECOMPUTED_TYPES.has(stored.prType) || !liveLogIds.has(stored.workoutLogId)) continue;
    const key = keyOf(stored.workoutLogId, stored.exerciseId, stored.prType);
    const want = desired.get(key);
    desired.delete(key);
    if (want && sameValues(want, stored)) {
      counts.skipped += 1;
      continue;
    }
    counts.updated += 1;
    const at = stampAfter(stamp, stored.updatedAt);
    records.push(
      want
        ? { ...stored, value: want.value, kg: want.kg, reps: want.reps, setId: want.setId, achievedAt: want.achievedAt, updatedAt: at }
        : { ...stored, deletedAt: at, updatedAt: at },
    );
  }
  const storedById = new Map(storedPRs.map((r) => [r.id, r]));
  for (const record of desired.values()) {
    const previous = storedById.get(record.id);
    if (previous === undefined) {
      counts.inserted += 1;
      records.push(record);
      continue;
    }
    counts.updated += 1;
    records.push({ ...record, createdAt: previous.createdAt, updatedAt: stampAfter(stamp, previous.updatedAt) });
  }
  return { logs, records, counts };
}
