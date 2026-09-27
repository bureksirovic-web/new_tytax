/**
 * TYTAX v2 — frozen training-engine contract (Wave 0, 2026-09-26).
 *
 * Pure functions, implemented by G1 in `src/lib/training` and exposed as the
 * `training` object (`import { training } from '@/lib/training'`).
 *
 * Shared rules:
 * - Only `done` sets of type `working`, `drop` or `failure` count ("done
 *   working sets"). Warm-ups and undone sets never count.
 * - Logs with `deletedAt` are ignored by every function.
 * - Weights are kg. Rounding to the plate increment is the caller's choice
 *   through the options; defaults are stated per function.
 * - Functions that depend on the clock take `now` explicitly.
 */

import type {
  ACWRResult,
  Exercise,
  PRType,
  SessionExercise,
  SetEntry,
  WarmupStrategy,
  WorkoutLog,
} from './domain';

/** Resolves an exercise id to its catalog entry (sync; load the catalog first). */
export type ExerciseLookup = (exerciseId: string) => Exercise | undefined;

// ─── e1RM ────────────────────────────────────────────────────────────────────

/**
 * Estimated one-rep max in kg: Brzycki (kg × 36 / (37 − reps)) for reps ≤ 36,
 * Epley (kg × (1 + reps / 30)) from 37 reps. reps ≤ 0 or kg ≤ 0 → 0; 1 rep → kg.
 */
export type E1rmFn = (kg: number, reps: number) => number;

// ─── Warm-ups ────────────────────────────────────────────────────────────────

export interface WarmupOptions {
  /** Empty-bar weight; no warm-up set goes below it. Default 20. */
  barKg?: number;
  /** Round each warm-up weight to this increment. Default 2.5. */
  roundToKg?: number;
}

/**
 * Warm-up sets (`type: 'warmup'`, `done: false`) for a working weight.
 * Strategies: `standard`, `heavy`, `pyramid`; `none` → []. A working weight
 * at or below the bar weight → [].
 */
export type GenerateWarmupsFn = (workingKg: number, strategy: WarmupStrategy, opts?: WarmupOptions) => SetEntry[];

// ─── Prefill (progression) ───────────────────────────────────────────────────

export interface PrefillOptions {
  /** Number of working sets to produce. Default: as many as last time (min 1). */
  targetSets?: number;
  /** Rep target text from the program slot, e.g. "8-12" (informational). */
  repTarget?: string;
}

export type PrefillBasis = 'none' | 'rir3plus' | 'rir2' | 'hold';

export interface PrefillResult {
  /**
   * Working sets (`done: false`) with `kg` pre-filled and `ghostKg`/`ghostReps`
   * set from the matching set of the last session. `reps` is 0 (user enters).
   */
  sets: SetEntry[];
  /** Suggested working weight in kg (0 when no history). */
  suggestedKg: number;
  /**
   * Why: last session's lowest recorded RIR over its done working sets was
   * ≥3 → +2.5 kg (`rir3plus`), exactly 2 → +1.25 kg (`rir2`), otherwise or
   * unrecorded → same kg (`hold`); no history → `none`.
   */
  basis: PrefillBasis;
  /** The log the prefill came from. */
  sourceLogId?: string;
}

/** `history` is any order; the newest non-deleted log containing the exercise is used. */
export type PrefillFromHistoryFn = (exerciseId: string, history: readonly WorkoutLog[], opts?: PrefillOptions) => PrefillResult;

// ─── PRs ─────────────────────────────────────────────────────────────────────

/** Best known value per PR type for one exercise (from stored PR records). */
export type ExistingBests = Readonly<Record<string, Partial<Record<PRType, number>>>>;

export interface PRCandidate {
  exerciseId: string;
  exerciseName: string;
  prType: PRType;
  value: number;
  kg: number;
  reps: number;
  setId: string;
  sessionExerciseUid: string;
  /** Previous best, or null when this is the first record (a baseline). */
  previousBest: number | null;
  /** First ever record for this exercise and type: stored, not celebrated. */
  isBaseline: boolean;
}

/**
 * PRs in a workout, at most one per (exerciseId, prType): the best done
 * working set, compared with `bests[exerciseId][prType]`. Produces `e1rm`
 * and `weight` PRs. Strictly greater than the previous best only.
 */
export type DetectPRsFn = (exercises: readonly SessionExercise[], bests: ExistingBests) => PRCandidate[];

// ─── Impact, lagging muscle ──────────────────────────────────────────────────

export interface DayRange {
  /** Inclusive 'YYYY-MM-DD'. */
  from?: string;
  to?: string;
}

/**
 * Share of training stimulus per muscle over done working sets in range:
 * each set adds `impact.score / 100` to every muscle it hits (standardised
 * names); the result is normalised so the shares sum to 1. No sets → {}.
 */
export type ImpactDistributionFn = (logs: readonly WorkoutLog[], lookup: ExerciseLookup, range?: DayRange) => Record<string, number>;

export interface LaggingResult {
  muscle: string;
  actualShare: number;
  targetShare: number;
  /** targetShare − actualShare (> 0 means under-trained). */
  gap: number;
}

/** The muscle with the largest positive gap to its target share, or null. */
export type LaggingMuscleFn = (distribution: Readonly<Record<string, number>>, targets?: Readonly<Record<string, number>>) => LaggingResult | null;

// ─── Recovery, ACWR, deload ──────────────────────────────────────────────────

export type RecoveryState = 'fresh' | 'recovering' | 'fried';

export interface MuscleRecovery {
  muscle: string;
  status: RecoveryState;
  lastTrainedAt: string | null;
  hoursSince: number | null;
  /** Impact-weighted done working sets in the last 48 hours. */
  load48h: number;
}

export interface RecoverySummary {
  /** Worst muscle state among muscles trained in the last 48 h; 'fresh' when none. */
  overall: RecoveryState;
  muscles: MuscleRecovery[];
}

/** Real 48-hour window measured from `now` (timestamps, not calendar strings). */
export type RecoveryStatusFn = (logs: readonly WorkoutLog[], lookup: ExerciseLookup, now: Date) => RecoverySummary;

/** Acute:chronic workload per muscle over done working sets; soft-deleted logs excluded. */
export type AcwrFn = (logs: readonly WorkoutLog[], lookup: ExerciseLookup, now: Date) => ACWRResult[];

export interface DeloadOptions {
  /** Round reduced weights to this increment. Default 1.25. */
  roundToKg?: number;
}

/** Deload a session: −1 working set per exercise (min 1) and −15 % kg. */
export type DeloadFn = (exercises: readonly SessionExercise[], opts?: DeloadOptions) => SessionExercise[];

// ─── Aggregate ───────────────────────────────────────────────────────────────

export interface TrainingApi {
  e1rm: E1rmFn;
  generateWarmups: GenerateWarmupsFn;
  prefillFromHistory: PrefillFromHistoryFn;
  detectPRs: DetectPRsFn;
  impactDistribution: ImpactDistributionFn;
  laggingMuscle: LaggingMuscleFn;
  recoveryStatus: RecoveryStatusFn;
  acwr: AcwrFn;
  deload: DeloadFn;
}
