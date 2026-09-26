/**
 * Raw legacy log -> LegacyLog.
 *
 * Coercion choices (documented contract for the mapping step):
 * - kg / reps: numeric strings are coerced ("82,5" -> 82.5); blank ('' / null /
 *   missing) -> 0, because a completed legacy set with a blank load was a
 *   bodyweight set and blank reps means "not entered".
 * - rir: blank -> undefined ("not recorded"), never 0 (0 would mean failure).
 * - A set whose kg, reps and rir are all blank AND that is not done is an
 *   untouched template row: dropped silently.
 * - Non-numeric text or negative kg/reps: the set is skipped with INVALID_SET.
 * - Missing set type -> 'working' (legacy rule `s.type === 'working' || !s.type`).
 * - duration over 24 h is not a real session: dropped (0) with INVALID_VALUE.
 */
import { epochMsFromId, normalizeDate, normalizeName, parseNumeric, safeIso } from './coerce';
import { rawExerciseSchema, rawLogSchema, rawSetSchema, validateRecord } from './schema';
import type { ImportWarning, LegacyExercise, LegacyLog, LegacySet, LegacySetType } from './types';

const SET_TYPES: Record<string, LegacySetType> = {
  warmup: 'warmup',
  'warm-up': 'warmup',
  working: 'working',
  work: 'working',
  drop: 'drop',
  dropset: 'drop',
  failure: 'failure',
};

function mapSetType(type: string | undefined, path: string, warnings: ImportWarning[]): LegacySetType {
  if (type === undefined || type === '') return 'working';
  const mapped = SET_TYPES[type.toLowerCase()];
  if (mapped) return mapped;
  warnings.push({ code: 'UNKNOWN_SET_TYPE', path: `${path}.type`, message: `Unknown set type "${type}" treated as working` });
  return 'working';
}

export function normalizeSet(raw: unknown, path: string, warnings: ImportWarning[]): LegacySet | null {
  const set = validateRecord(rawSetSchema, raw, path, warnings, 'INVALID_SET');
  if (!set) return null;
  const done = set.done === true;
  const kg = parseNumeric(set.kg);
  const reps = parseNumeric(set.reps);
  const rir = parseNumeric(set.rir);
  if (kg === 'blank' && reps === 'blank' && rir === 'blank' && !done) return null;
  if (kg === 'invalid' || reps === 'invalid' || (typeof kg === 'number' && kg < 0) || (typeof reps === 'number' && reps < 0)) {
    warnings.push({ code: 'INVALID_SET', path, message: 'Skipped: kg/reps is not a non-negative number' });
    return null;
  }
  const out: LegacySet = {
    kg: kg === 'blank' ? 0 : kg,
    reps: reps === 'blank' ? 0 : reps,
    done,
    type: mapSetType(set.type, path, warnings),
  };
  if (typeof rir === 'number' && rir >= 0) out.rir = rir;
  else if (rir !== 'blank') {
    warnings.push({ code: 'INVALID_VALUE', path: `${path}.rir`, message: 'Unreadable RIR dropped' });
  }
  return out;
}

export function normalizeExercise(raw: unknown, path: string, warnings: ImportWarning[]): LegacyExercise | null {
  const ex = validateRecord(rawExerciseSchema, raw, path, warnings);
  if (!ex) return null;
  const legacyName = normalizeName(ex.name);
  if (legacyName === '') {
    warnings.push({ code: 'INVALID_RECORD', path: `${path}.name`, message: 'Skipped: empty exercise name' });
    return null;
  }
  const sets: LegacySet[] = [];
  ex.sets.forEach((s, i) => {
    const set = normalizeSet(s, `${path}.sets[${i}]`, warnings);
    if (set) sets.push(set);
  });
  return { legacyName, sets };
}

function optionalNumber(value: unknown, path: string, warnings: ImportWarning[]): number | undefined {
  const n = parseNumeric(value);
  if (n === 'blank') return undefined;
  if (n === 'invalid' || n < 0) {
    warnings.push({ code: 'INVALID_VALUE', path, message: 'Unreadable number dropped' });
    return undefined;
  }
  return n;
}

/** A legacy session longer than a day is corrupt data, not a workout. */
export const MAX_DURATION_SECONDS = 24 * 60 * 60;

function readDuration(value: unknown, path: string, warnings: ImportWarning[]): number {
  const n = optionalNumber(value, path, warnings) ?? 0;
  if (n <= MAX_DURATION_SECONDS) return n;
  warnings.push({ code: 'INVALID_VALUE', path, message: 'Duration over 24 h dropped' });
  return 0;
}

export function normalizeLog(raw: unknown, index: number, path: string, warnings: ImportWarning[]): LegacyLog | null {
  const log = validateRecord(rawLogSchema, raw, path, warnings);
  if (!log) return null;
  const day = normalizeDate(log.date);
  if (!day) {
    warnings.push({ code: 'INVALID_RECORD', path: `${path}.date`, message: `Skipped: unreadable date "${log.date}"` });
    return null;
  }
  const durationSeconds = readDuration(log.duration, `${path}.duration`, warnings);
  const out: LegacyLog = {
    sourceId: log.id !== undefined ? String(log.id) : `legacy:${day.date}:${index}`,
    date: day.date,
    sessionName: log.session,
    durationSeconds,
    exercises: [],
  };
  const epoch = epochMsFromId(log.id);
  const startedAt = day.iso ?? (epoch !== undefined && durationSeconds > 0 ? safeIso(epoch - durationSeconds * 1000) : undefined);
  if (startedAt !== undefined) out.startedAt = startedAt;
  const finishedAt = epoch !== undefined ? safeIso(epoch) : undefined;
  if (finishedAt !== undefined) out.finishedAt = finishedAt;
  const rpe = optionalNumber(log.rpe, `${path}.rpe`, warnings);
  if (rpe !== undefined) out.rpe = rpe;
  if (typeof log.notes === 'string' && log.notes.trim() !== '') out.notes = log.notes;
  if (log.isDeload !== undefined) out.isDeload = log.isDeload;
  log.exercises.forEach((e, i) => {
    const ex = normalizeExercise(e, `${path}.exercises[${i}]`, warnings);
    if (ex) out.exercises.push(ex);
  });
  return out;
}

/**
 * Normalizes a list; a source id already emitted gets the lowest free
 * deterministic "#n" suffix (n >= 2) and a warning, so sourceIds stay unique
 * even when a real id looks like a generated one ('5', '5', '5#2').
 */
export function normalizeLogs(raw: readonly unknown[], path: string, warnings: ImportWarning[]): LegacyLog[] {
  const emitted = new Set<string>();
  const out: LegacyLog[] = [];
  raw.forEach((item, i) => {
    const log = normalizeLog(item, i, `${path}[${i}]`, warnings);
    if (!log) return;
    if (emitted.has(log.sourceId)) {
      warnings.push({ code: 'DUPLICATE_LOG_ID', path: `${path}[${i}].id`, message: `Duplicate log id ${log.sourceId}` });
      let k = 2;
      while (emitted.has(`${log.sourceId}#${k}`)) k += 1;
      log.sourceId = `${log.sourceId}#${k}`;
    }
    emitted.add(log.sourceId);
    out.push(log);
  });
  return out;
}
