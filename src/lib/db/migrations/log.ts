/**
 * Dexie v2 -> v3 workout log transform (pure).
 *
 * v2 logs keyed sets by `exerciseRef`, so one exercise could appear only once
 * and totals counted warm-ups. v3 logs hold `SessionExercise[]` with a
 * per-session `uid`, and totals count done working sets only.
 *
 * v2 `finishWorkout` read `sets[exerciseRef]`, so a repeated exercise shared
 * one sets array (same set ids) and the sets were stored, and totalled, twice.
 * The later copy keeps its slot with no sets; any other colliding set id is
 * re-issued so set ids stay unique within the log.
 */
import type { LegacyExerciseLogV2, LegacyWorkoutLogV2, SessionExercise, SetEntry, WorkoutLog } from '@/contracts';
import { clampRir, compact, finiteOr, isRecord, recordsOf, strOr, toModalities, toModality } from './coerce';

type LegacySetV2 = LegacyExerciseLogV2['sets'][number];

/**
 * A log is v3 when every exercise carries a `uid` and the fields v3 requires
 * (and v2 lacked or had optional) are present. Migration output always passes.
 */
export function isV3Log(log: LegacyWorkoutLogV2 | WorkoutLog): log is WorkoutLog {
  const exercises: unknown = log.exercises;
  return (
    Array.isArray(exercises) &&
    exercises.every((e) => isRecord(e) && typeof e.uid === 'string') &&
    typeof log.finishedAt === 'string' &&
    typeof log.updatedAt === 'string' &&
    !('familyMemberId' in log)
  );
}

function migrateSet(set: LegacySetV2, logId: string, exIndex: number, setIndex: number): SetEntry {
  const done = set.done === true;
  return compact<SetEntry>({
    id: strOr(set.id, `${logId}:${exIndex}:${setIndex}`),
    type: set.type,
    kg: finiteOr(set.kg, 0),
    reps: finiteOr(set.reps, 0),
    rir: clampRir(set.rir),
    done,
    completedAt: done && typeof set.timestamp === 'string' && set.timestamp !== '' ? set.timestamp : undefined,
    isPR: set.isPersonalRecord === true ? true : undefined,
    e1rm: typeof set.e1rm === 'number' && Number.isFinite(set.e1rm) ? set.e1rm : undefined,
    tempo: set.tempo,
  });
}

interface SeenSets {
  /** `exerciseRef` + ordered set ids of every exercise migrated so far. */
  signatures: Set<string>;
  setIds: Set<string>;
}

function uniqueSetId(set: SetEntry, fallback: string, seen: Set<string>): SetEntry {
  let id = set.id;
  for (let n = 1; seen.has(id); n += 1) id = n === 1 ? fallback : `${fallback}:${n}`;
  seen.add(id);
  return id === set.id ? set : { ...set, id };
}

function migrateExercise(ex: LegacyExerciseLogV2, logId: string, index: number, seen: SeenSets): SessionExercise {
  const raw = recordsOf<LegacySetV2>(ex.sets);
  const signature = JSON.stringify([ex.exerciseRef, raw.map((s) => s.id)]);
  const allIds = raw.every((s) => typeof s.id === 'string' && s.id !== '');
  const shared = raw.length > 0 && allIds && seen.signatures.has(signature);
  seen.signatures.add(signature);
  const sets = shared
    ? []
    : raw.map((s, j) => uniqueSetId(migrateSet(s, logId, index, j), `${logId}:${index}:${j}`, seen.setIds));
  return compact<SessionExercise>({
    uid: `${logId}:${index}`,
    exerciseId: ex.exerciseRef,
    exerciseName: strOr(ex.exerciseName, ex.exerciseRef),
    modality: toModality(ex.modality),
    sets,
    restSeconds: ex.restSeconds,
    notes: ex.notes,
    supersetGroup: ex.supersetGroup,
    muscleImpactSnapshot: ex.muscleImpactSnapshot,
  });
}

/** Contract totals: Σ kg×reps and count over done, non-warm-up sets; PRs likewise. */
export function computeTotals(exercises: readonly SessionExercise[]): {
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
} {
  let totalVolumeKg = 0;
  let totalSets = 0;
  let prCount = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.done || s.type === 'warmup') continue;
      totalVolumeKg += s.kg * s.reps;
      totalSets += 1;
      if (s.isPR === true) prCount += 1;
    }
  }
  return { totalVolumeKg, totalSets, prCount };
}

/**
 * `isV3Log` cannot tell a v2 log with no exercises and no `familyMemberId` key
 * from a v3 one (the uid check is vacuous). Coerce what v2 could have left
 * wrong: modality spelling ('TYTAX') and, with no exercises, totals (v2 kept
 * its own). A real v3 row already satisfies both and comes back as the same
 * object; totals of a log with exercises are left to the repo that wrote them.
 */
function normaliseV3Log(log: WorkoutLog): WorkoutLog {
  const raw: readonly unknown[] = Array.isArray(log.modalitiesUsed) ? log.modalitiesUsed : [];
  const modalitiesUsed = toModalities(raw);
  const sameModalities = modalitiesUsed.length === raw.length && modalitiesUsed.every((m, i) => m === raw[i]);
  const empty = log.exercises.length === 0;
  const zeroTotals = log.totalVolumeKg === 0 && log.totalSets === 0 && log.prCount === 0;
  if (sameModalities && (!empty || zeroTotals)) return log;
  return { ...log, modalitiesUsed, ...(empty ? computeTotals([]) : {}) };
}

function addSeconds(iso: string, seconds: number): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t + seconds * 1000).toISOString();
}

/**
 * Migrate one v2 log to v3. A v3 log is returned unchanged (same object).
 * `familyMemberId` is dropped: the snapshot migration folds it into
 * `profileId` before calling this.
 */
export function migrateLogV2(log: LegacyWorkoutLogV2 | WorkoutLog, ctx: { now: string }): WorkoutLog {
  if (isV3Log(log)) return normaliseV3Log(log);
  const legacy = log as LegacyWorkoutLogV2;
  const legacyExercises = recordsOf<LegacyExerciseLogV2>(legacy.exercises);
  const seen: SeenSets = { signatures: new Set(), setIds: new Set() };
  const exercises = legacyExercises.map((ex, i) => migrateExercise(ex, legacy.id, i, seen));
  const durationSeconds = Math.max(0, finiteOr(legacy.durationSeconds, 0));
  const startedAt = strOr(legacy.startedAt, strOr(legacy.createdAt, ctx.now));
  const createdAt = strOr(legacy.createdAt, startedAt);
  const modalitiesUsed =
    exercises.length > 0 ? toModalities(exercises.map((e) => e.modality)) : toModalities(legacy.modalitiesUsed ?? []);
  return compact<WorkoutLog>({
    id: legacy.id,
    profileId: legacy.profileId,
    programId: legacy.programId,
    sessionName: strOr(legacy.sessionName, 'Quick Workout'),
    date: strOr(legacy.date, startedAt.slice(0, 10)),
    startedAt,
    finishedAt: strOr(legacy.finishedAt, addSeconds(startedAt, durationSeconds)),
    durationSeconds,
    exercises,
    notes: legacy.notes,
    rpe: legacy.rpe,
    bodyweightKg: legacy.bodyweightKg,
    ...computeTotals(exercises),
    modalitiesUsed,
    createdAt,
    updatedAt: strOr(legacy.updatedAt, createdAt),
    deletedAt: legacy.deletedAt,
    syncedAt: legacy.syncedAt,
  });
}
