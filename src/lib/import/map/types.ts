/** Types of the pure legacy -> contract mapping step. */
import type { BodyweightEntry, Catalog, Program, ProfileSettings, WorkoutLog } from '@/contracts';
import type { LegacySharedData } from '../types';

/** Anything that can look an exercise up by its legacy name (the G1 catalog, or the fallback). */
export type LegacyNameResolver = Pick<Catalog, 'getByLegacyName'>;

export interface MapContext {
  /** Profile that receives every mapped record. */
  profileId: string;
  resolver: LegacyNameResolver;
  /** ISO timestamp used for createdAt/updatedAt. Injected; the mapper never reads the clock. */
  importedAt: string;
  /** Name of the program built from trainingPlan + sessionOrder. Default 'TYTAX (uvezeno)'. */
  planName?: string;
  /** Device-global legacy settings (multi-user dumps); used only where the user has no own value. */
  sharedSettings?: LegacySharedData['settings'];
}

export type MapWarningCode =
  | 'RPE_OUT_OF_RANGE'
  | 'RIR_CLAMPED'
  | 'START_TIME_FALLBACK'
  | 'INVALID_BODYWEIGHT'
  | 'UNKNOWN_WARMUP_STRATEGY'
  | 'PLAN_SESSION_MISSING'
  | 'PLAN_SESSION_UNUSED'
  | 'REST_SESSION_EXERCISES_DROPPED';

export interface MapWarning {
  code: MapWarningCode;
  /** Location in the legacy user data, e.g. "logs[2].rpe" or "customProtocols[0].plan.Full A". */
  path: string;
  message: string;
}

export interface UnresolvedExercise {
  /** Name exactly as the legacy data had it (after the parser's whitespace normalization). */
  legacyName: string;
  /** Times it appears across log exercises and program slots. */
  occurrences: number;
}

export interface MappedUser {
  logs: WorkoutLog[];
  bodyweight: BodyweightEntry[];
  /** The imported active plan first (when present), then one inactive program per custom protocol. */
  programs: Program[];
  activeProgramId: string | null;
  settings: Partial<ProfileSettings>;
  /** Sorted by legacyName. */
  unresolved: UnresolvedExercise[];
  warnings: MapWarning[];
}
