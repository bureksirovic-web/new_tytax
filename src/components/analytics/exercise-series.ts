/**
 * Per-exercise derivations: e1RM / top-set / volume series, best lifts,
 * pinned-metric summaries and movement-pattern balance. Only done working
 * kg sets of live logs count (warm-ups, undone and time-measured sets never do).
 */
import type { WorkoutLog } from '@/contracts/domain';
import { training } from '@/lib/training';
import { logTimeMs } from './analytics-dates';
import { isKgSet, liveLogs } from './analytics-math';

export interface SessionPoint {
  logId: string;
  date: string;
  /** Best e1RM of the session, kg. */
  e1rm: number;
  /** Heaviest done working set, kg. */
  topKg: number;
  /** Σ kg × reps of done working sets, kg. */
  volumeKg: number;
  /** The set that gave the best e1RM. */
  bestKg: number;
  bestReps: number;
}

/** One point per live session that has a done working set of `exerciseId`, oldest first. */
export function exerciseSeries(logs: readonly WorkoutLog[], exerciseId: string): SessionPoint[] {
  const out: Array<SessionPoint & { t: number }> = [];
  for (const log of liveLogs(logs)) {
    let point: (SessionPoint & { t: number }) | null = null;
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (!isKgSet(s)) continue;
        point ??= { logId: log.id, date: log.date, e1rm: 0, topKg: 0, volumeKg: 0, bestKg: 0, bestReps: 0, t: logTimeMs(log) };
        const e = training.e1rm(s.kg, s.reps);
        if (e > point.e1rm) Object.assign(point, { e1rm: e, bestKg: s.kg, bestReps: s.reps });
        point.topKg = Math.max(point.topKg, s.kg);
        point.volumeKg += s.kg * s.reps;
      }
    }
    if (point) out.push(point);
  }
  out.sort((a, b) => a.t - b.t || a.date.localeCompare(b.date));
  return out.map((p) => {
    const { t, ...point } = p;
    void t;
    return point;
  });
}

export interface TrainedExercise {
  id: string;
  name: string;
}

/** Exercises with at least one done working set, sorted by display name. */
export function trainedExercises(logs: readonly WorkoutLog[], nameOf: (id: string, fallback?: string) => string): TrainedExercise[] {
  const names = new Map<string, string>();
  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      if (names.has(ex.exerciseId) || !ex.sets.some(isKgSet)) continue;
      names.set(ex.exerciseId, nameOf(ex.exerciseId, ex.exerciseName));
    }
  }
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export interface BestLift {
  exerciseId: string;
  e1rm: number;
  kg: number;
  reps: number;
  date: string;
}

/** Best e1RM set per exercise, highest first. */
export function bestLifts(logs: readonly WorkoutLog[]): BestLift[] {
  const best = new Map<string, BestLift>();
  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (!isKgSet(s)) continue;
        const e = training.e1rm(s.kg, s.reps);
        const cur = best.get(ex.exerciseId);
        if (!cur || e > cur.e1rm) best.set(ex.exerciseId, { exerciseId: ex.exerciseId, e1rm: e, kg: s.kg, reps: s.reps, date: log.date });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm || a.exerciseId.localeCompare(b.exerciseId));
}

export interface PinnedSummary {
  exerciseId: string;
  points: SessionPoint[];
  best: number | null;
  latest: number | null;
  /** latest − previous session's e1RM; null with fewer than 2 sessions. */
  delta: number | null;
}

export function pinnedSummary(logs: readonly WorkoutLog[], exerciseId: string): PinnedSummary {
  const points = exerciseSeries(logs, exerciseId);
  const last = points.at(-1);
  const prev = points.at(-2);
  return {
    exerciseId,
    points,
    best: points.length ? Math.max(...points.map((p) => p.e1rm)) : null,
    latest: last ? last.e1rm : null,
    delta: last && prev ? last.e1rm - prev.e1rm : null,
  };
}

export { movementParity, patternOf, PATTERN_TARGETS, type MovementPattern, type ParityRow } from './movement-balance';
