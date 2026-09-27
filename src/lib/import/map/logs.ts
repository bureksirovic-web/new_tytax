/**
 * LegacyLog -> WorkoutLog.
 *
 * Decisions:
 * - Totals follow the training contract ("done working sets" = done sets of
 *   type working, drop or failure; warm-ups and undone sets never count).
 *   totalVolumeKg is rounded to 3 decimals to drop float noise.
 * - prCount is 0: the importer recomputes PRs via training.detectPRs.
 * - startedAt: the parser's value; else finishedAt − duration; else
 *   `${date}T12:00:00.000Z` (noon UTC keeps the calendar day in every
 *   European zone) with a START_TIME_FALLBACK warning.
 * - finishedAt is always startedAt + durationSeconds.
 * - rpe: below 1 (0 = "not entered") or non-finite is dropped; above 10 is
 *   clamped to 10; both with RPE_OUT_OF_RANGE.
 * - rir: clamped to 0–5 (RIR_CLAMPED); undefined stays undefined.
 * - exerciseName is the catalog name when resolved, else the legacy name.
 */
import type { Modality, SessionExercise, SetEntry, WorkoutLog } from '@/contracts';
import type { LegacyExercise, LegacyLog, LegacySet } from '../types';
import type { NameTable } from './resolver';
import type { MapWarning } from './types';
import { importId } from './uuid';

export interface LogMapContext {
  profileId: string;
  /** legacyIdScope(profileId, username): prefix of every derived id. */
  idScope: string;
  importedAt: string;
  names: NameTable;
  warnings: MapWarning[];
}

const COUNTED_TYPES: ReadonlySet<SetEntry['type']> = new Set(['working', 'drop', 'failure']);

export function countsTowardTotals(set: SetEntry): boolean {
  return set.done && COUNTED_TYPES.has(set.type);
}

export function sortedModalities(items: ReadonlyArray<{ modality: Modality }>): Modality[] {
  return [...new Set(items.map((i) => i.modality))].sort();
}

function mapSet(set: LegacySet, id: string, path: string, warnings: MapWarning[]): SetEntry {
  const out: SetEntry = { id, type: set.type, kg: set.kg, reps: set.reps, done: set.done };
  if (set.rir !== undefined && Number.isFinite(set.rir)) {
    const rir = Math.min(5, Math.max(0, set.rir));
    if (rir !== set.rir) warnings.push({ code: 'RIR_CLAMPED', path: `${path}.rir`, message: `RIR ${set.rir} clamped to ${rir}` });
    out.rir = rir;
  }
  return out;
}

function mapExercise(ex: LegacyExercise, logKey: string, index: number, path: string, ctx: LogMapContext): SessionExercise {
  const ref = ctx.names.ref(ex.legacyName);
  const sets = ex.sets.map((s, j) =>
    mapSet(s, importId(ctx.idScope, 'set', `${logKey}|${index}|${j}`), `${path}.sets[${j}]`, ctx.warnings),
  );
  const out: SessionExercise = {
    uid: importId(ctx.idScope, 'session-exercise', `${logKey}|${index}`),
    exerciseId: ref.exerciseId,
    exerciseName: ref.exerciseName,
    modality: ref.modality,
    sets,
  };
  if (ref.impact !== undefined) out.muscleImpactSnapshot = ref.impact.map((m) => ({ ...m }));
  return out;
}

function validMs(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

function startOf(log: LegacyLog, path: string, warnings: MapWarning[]): string {
  const started = validMs(log.startedAt);
  if (started !== undefined) return new Date(started).toISOString();
  const finished = validMs(log.finishedAt);
  if (finished !== undefined) return new Date(finished - log.durationSeconds * 1000).toISOString();
  warnings.push({ code: 'START_TIME_FALLBACK', path, message: `No start time; using ${log.date}T12:00:00.000Z` });
  return `${log.date}T12:00:00.000Z`;
}

function mapRpe(rpe: number | undefined, path: string, warnings: MapWarning[]): number | undefined {
  if (rpe === undefined) return undefined;
  if (Number.isFinite(rpe) && rpe >= 1 && rpe <= 10) return rpe;
  if (Number.isFinite(rpe) && rpe > 10) {
    warnings.push({ code: 'RPE_OUT_OF_RANGE', path, message: `RPE ${rpe} clamped to 10` });
    return 10;
  }
  warnings.push({ code: 'RPE_OUT_OF_RANGE', path, message: `RPE ${rpe} dropped` });
  return undefined;
}

export function computeTotals(exercises: readonly SessionExercise[]): { totalVolumeKg: number; totalSets: number } {
  let volume = 0;
  let count = 0;
  for (const set of exercises.flatMap((e) => e.sets)) {
    if (!countsTowardTotals(set)) continue;
    volume += set.kg * set.reps;
    count += 1;
  }
  return { totalVolumeKg: Math.round(volume * 1000) / 1000, totalSets: count };
}

export function mapLog(log: LegacyLog, index: number, ctx: LogMapContext): WorkoutLog {
  const path = `logs[${index}]`;
  const exercises = log.exercises.map((ex, i) => mapExercise(ex, log.sourceId, i, `${path}.exercises[${i}]`, ctx));
  const startedAt = startOf(log, `${path}.startedAt`, ctx.warnings);
  const finishedAt = new Date(Date.parse(startedAt) + log.durationSeconds * 1000).toISOString();
  const out: WorkoutLog = {
    id: importId(ctx.idScope, 'log', log.sourceId),
    profileId: ctx.profileId,
    sessionName: log.sessionName,
    date: log.date,
    startedAt,
    finishedAt,
    durationSeconds: log.durationSeconds,
    exercises,
    ...computeTotals(exercises),
    prCount: 0,
    modalitiesUsed: sortedModalities(exercises),
    createdAt: ctx.importedAt,
    updatedAt: ctx.importedAt,
  };
  const rpe = mapRpe(log.rpe, `${path}.rpe`, ctx.warnings);
  if (rpe !== undefined) out.rpe = rpe;
  if (log.notes !== undefined) out.notes = log.notes;
  if (log.isDeload !== undefined) out.isDeload = log.isDeload;
  return out;
}
