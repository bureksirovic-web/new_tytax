/**
 * Per-exercise derivations: e1RM / top-set / volume series, best lifts,
 * pinned-metric summaries and movement-pattern balance. Only done working
 * sets of live logs count (warm-ups and undone sets never do).
 */
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { isDoneWorkingSet, training } from '@/lib/training';
import { logTimeMs } from './analytics-dates';
import { liveLogs } from './analytics-math';

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
        if (!isDoneWorkingSet(s)) continue;
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
      if (names.has(ex.exerciseId) || !ex.sets.some(isDoneWorkingSet)) continue;
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
        if (!isDoneWorkingSet(s)) continue;
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

// ─── Movement balance ────────────────────────────────────────────────────────

export type MovementPattern = 'push' | 'pull' | 'quad' | 'hinge' | 'carry' | 'core' | 'other';

const PATTERN_WORDS: ReadonlyArray<[string, MovementPattern]> = [
  ['push', 'push'], ['press', 'push'], ['pull', 'pull'], ['row', 'pull'], ['squat', 'quad'], ['lunge', 'quad'],
  ['hinge', 'hinge'], ['deadlift', 'hinge'], ['swing', 'hinge'], ['snatch', 'hinge'], ['carry', 'carry'],
  ['core', 'core'], ['tgu', 'core'], ['windmill', 'core'],
];

/** Balanced-training target share per pattern, percent (sums to 100). */
export const PATTERN_TARGETS: Readonly<Record<MovementPattern, number>> = { push: 20, pull: 20, quad: 20, hinge: 20, carry: 5, core: 10, other: 5 };

export function patternOf(exerciseId: string, lookup: ExerciseLookup): MovementPattern {
  const raw = lookup(exerciseId)?.pattern?.toLowerCase() ?? '';
  return PATTERN_WORDS.find(([word]) => raw.includes(word))?.[1] ?? 'other';
}

export interface ParityRow {
  pattern: MovementPattern;
  pct: number;
  target: number;
  onTarget: boolean;
}

/** Volume share per movement pattern for logs on or after `fromDay`; [] without volume. */
export function movementParity(logs: readonly WorkoutLog[], lookup: ExerciseLookup, fromDay: string): ParityRow[] {
  const vol = new Map<MovementPattern, number>();
  let total = 0;
  for (const log of liveLogs(logs)) {
    if (log.date < fromDay) continue;
    for (const ex of log.exercises) {
      const v = ex.sets.filter(isDoneWorkingSet).reduce((sum, s) => sum + s.kg * s.reps, 0);
      if (v <= 0) continue;
      const p = patternOf(ex.exerciseId, lookup);
      vol.set(p, (vol.get(p) ?? 0) + v);
      total += v;
    }
  }
  if (total <= 0) return [];
  return (Object.keys(PATTERN_TARGETS) as MovementPattern[]).map((pattern) => {
    const pct = ((vol.get(pattern) ?? 0) / total) * 100;
    const target = PATTERN_TARGETS[pattern];
    return { pattern, pct, target, onTarget: Math.abs(pct - target) <= 5 };
  });
}
