/**
 * TYTAX v2 — frozen domain contract (Wave 0, 2026-09-26).
 *
 * Change only through `docs/v2/requests/G<n>-<nn>.md` (one file per request).
 * After Wave 0 a goal may add an *optional* field here and must record it in
 * its request file; nothing else changes without the contract owner's go.
 *
 * Conventions (all goals rely on these):
 * - Every weight is stored in **kg**. `Units` only changes display and input.
 * - User-data ids are `crypto.randomUUID()`; catalog and preset ids are stable slugs.
 * - Timestamps are ISO-8601 UTC strings (`new Date().toISOString()`).
 *   `date` fields are the local calendar day, `'YYYY-MM-DD'`.
 * - Every user-data record carries `profileId` and is soft-deleted through
 *   `deletedAt`. Repository reads hide soft-deleted rows unless asked.
 * - Family profiles are local and are **not** a security boundary.
 */

// ─── Exercise catalog ────────────────────────────────────────────────────────

export type Modality = 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

export type MuscleGroup =
  | 'CHEST'
  | 'BACK_VERTICAL'
  | 'BACK_HORIZONTAL'
  | 'SHOULDERS'
  | 'BICEPS'
  | 'TRICEPS'
  | 'FOREARMS_GRIP'
  | 'QUADS'
  | 'HAMSTRINGS'
  | 'GLUTES'
  | 'CALVES'
  | 'CORE';

export type TechniqueLevel = 'basic' | 'intermediate' | 'advanced';

export type EquipmentRequirement =
  | 'none'
  | 'pull-up-bar'
  | 'dip-station'
  | 'rings'
  | 'parallettes'
  | 'kettlebell'
  | 'tytax';

export interface MuscleImpact {
  /** Muscle name; standardised names live in `MUSCLE_GROUPS` (`src/lib/constants.ts`). */
  muscle: string;
  /** 0–100. */
  score: number;
}

export interface Video {
  url: string;
  label: string;
}

export interface WeightTier {
  male: { beginner: number; intermediate: number; advanced: number };
  female: { beginner: number; intermediate: number; advanced: number };
  other: { beginner: number; intermediate: number; advanced: number };
}

/**
 * How a TYTAX exercise got its station/attachment:
 * `t1x-meta` (from the T1-X metadata), `name-rule:<ruleId>` (a deterministic
 * name rule), or `manual` (a reviewed hand mapping).
 */
export type StationProvenance = 't1x-meta' | `name-rule:${string}` | 'manual';

export interface Exercise {
  /** Stable id, never reused. */
  id: string;
  name: string;
  modality: Modality;
  /** Display name of the station (TYTAX only). Kept for older UI code. */
  station?: string;
  /** Valid station key from `tytax_library.json` STATIONS (TYTAX only). */
  stationId?: string;
  /** Valid attachment ids (TYTAX cable work). */
  attachmentIds?: string[];
  stationProvenance?: StationProvenance;
  /** T1-X exercise number from the source data, when known. */
  t1xNumber?: number;
  /** Exact name used by tytax-autonomous; the legacy import maps by it. */
  legacyName?: string;
  muscleGroup: MuscleGroup;
  pattern: string;
  isUnilateral: boolean;
  defaultSets: number;
  /** "8-12" or "10-15/side". */
  defaultReps: string;
  impact: MuscleImpact[];
  /** How a set of this exercise is measured. Undefined means 'reps'. (Wave 2, F2) */
  measure?: ExerciseMeasure;
  /** "3-1-2-0". */
  tempo?: string;
  restSeconds?: number;
  /** Ordered: app.tytax first when present, then YouTube. */
  videos?: Video[];
  note?: string;
  // Bodyweight specific
  /** 1–10. */
  difficultyLevel?: number;
  progressionParentId?: string;
  progressionChildIds?: string[];
  requiresEquipment?: EquipmentRequirement[];
  // Kettlebell specific
  recommendedWeightKg?: WeightTier;
  techniqueLevel?: TechniqueLevel;
  // General
  tags?: string[];
  searchTerms?: string[];
}

export interface ProgressionChain {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  /** Ordered exercise ids. */
  exercises: string[];
}

export interface Station {
  /** Key from `tytax_library.json` STATIONS, e.g. `SMITH`. */
  id: string;
  name: string;
  notes?: string;
}

export interface AttachmentDef {
  id: string;
  name: string;
  priority?: 'High' | 'Medium' | 'Low' | string;
  why?: string;
}

// ─── Sets, sessions, logs ────────────────────────────────────────────────────

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

/** 'time' = static holds, carries, stretches: the set records `durationSeconds`. */
export type ExerciseMeasure = 'reps' | 'time';

/**
 * One set. Warm-ups (`type: 'warmup'`) and sets with `done: false` never
 * count toward PRs, volume, impact, recovery or ACWR.
 */
export interface SetEntry {
  /** Unique id (uuid). */
  id: string;
  type: SetType;
  kg: number;
  reps: number;
  /** Reps in reserve, 0–5. Undefined when not recorded. */
  rir?: number;
  done: boolean;
  /** When the set was marked done. */
  completedAt?: string;
  /** Set by `finishWorkout` when this set produced a (non-baseline) PR. */
  isPR?: boolean;
  /** e1RM of this set in kg, filled by `finishWorkout`. */
  e1rm?: number;
  tempo?: string;
  /** Prefill hint shown as a placeholder: last session's kg for this set index. */
  ghostKg?: number;
  /** Prefill hint shown as a placeholder: last session's reps ("beat it"). */
  ghostReps?: number;
  /** Time-measured sets only (`Exercise.measure === 'time'`): seconds held. Excluded from e1RM and kg volume. */
  durationSeconds?: number;
  /** Prefill hint for time-measured sets: last session's seconds for this set index. */
  ghostDurationSeconds?: number;
}

/**
 * One exercise inside a session or log. `uid` is unique within the session,
 * so the same `exerciseId` may appear more than once.
 */
export interface SessionExercise {
  uid: string;
  exerciseId: string;
  /** Snapshot at log time. */
  exerciseName: string;
  modality: Modality;
  sets: SetEntry[];
  restSeconds?: number;
  notes?: string;
  /** 'A', 'B', … */
  supersetGroup?: string;
  muscleImpactSnapshot?: MuscleImpact[];
}

/**
 * The in-progress workout. Persisted by the workout store so it survives a
 * reload. `id` becomes `WorkoutLog.id`: it is the idempotency key of
 * `Repository.finishWorkout`.
 */
export interface WorkoutDraft {
  id: string;
  profileId: string;
  programId?: string;
  programSessionId?: string;
  sessionName: string;
  startedAt: string;
  exercises: SessionExercise[];
  isDeload?: boolean;
  notes?: string;
}

/** What the user enters on the debrief screen. */
export interface WorkoutDebrief {
  /** 1–10. */
  rpe?: number;
  notes?: string;
  bodyweightKg?: number;
  /** Defaults to now. */
  finishedAt?: string;
}

export interface WorkoutLog {
  /** Equals the `WorkoutDraft.id` it was finished from. */
  id: string;
  profileId: string;
  programId?: string;
  programSessionId?: string;
  sessionName: string;
  /** Local calendar day of `startedAt`, 'YYYY-MM-DD'. */
  date: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exercises: SessionExercise[];
  notes?: string;
  /** 1–10. */
  rpe?: number;
  bodyweightKg?: number;
  /** Σ kg × reps over done working sets. */
  totalVolumeKg: number;
  /** Count of done working sets. */
  totalSets: number;
  /** Non-baseline PRs set in this workout. */
  prCount: number;
  modalitiesUsed: Modality[];
  isDeload?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncedAt?: string;
}

// ─── Programs ────────────────────────────────────────────────────────────────

export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'custom';

export type PeriodizationType = 'none' | 'linear' | 'undulating' | 'block';

export interface PeriodizationConfig {
  type: PeriodizationType;
  /** Linear: add X kg every N weeks. */
  linearIncrement?: number;
  linearFrequencyWeeks?: number;
  /** Undulating: alternating rep ranges per session. */
  undulatingRanges?: string[];
  /** Block: phases in weeks. */
  blockPhases?: Array<{ name: string; weeks: number; focus: string }>;
}

/** One exercise slot in a program session template. */
export interface ProgramExercise {
  exerciseId: string;
  exerciseName: string;
  modality: Modality;
  sets: number;
  reps: string;
  tempo?: string;
  restSeconds?: number;
  supersetGroup?: string;
}

export interface ProgramSession {
  id: string;
  programId: string;
  name: string;
  dayIndex: number;
  exercises: ProgramExercise[];
  /** A rest day in the rotation (no exercises). */
  isRest?: boolean;
}

/**
 * A program owned by one profile. Which program is active lives on the
 * profile (`Profile.activeProgramId`), never on the program.
 */
export interface Program {
  id: string;
  profileId: string;
  name: string;
  splitType: SplitType;
  /** Training days per week. */
  frequency: number;
  periodizationType: PeriodizationType;
  periodizationConfig?: PeriodizationConfig;
  /** Session names in rotation order (informational; `sessions` is authoritative). */
  sessionOrder: string[];
  /** Ordered rotation. */
  sessions: ProgramSession[];
  modalitiesUsed: Modality[];
  isPreset: boolean;
  /** Stable id of the preset it was installed from. */
  presetId?: string;
  /** Rotation pointer: index into `sessions` of the next session to train. */
  currentSessionIndex: number;
  /** 'YYYY-MM-DD'. */
  rotationStartDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A program before it is installed for a profile (presets, builder output). */
export type ProgramTemplate = Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

// ─── Profiles and settings ───────────────────────────────────────────────────

export type Units = 'kg' | 'lb';
export type Language = 'hr' | 'en';
export type WarmupStrategy = 'standard' | 'heavy' | 'pyramid' | 'none';
export type ThemeName = 'tactical' | 'oled';
export type Gender = 'male' | 'female' | 'other';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ProfileSettings {
  units: Units;
  language: Language;
  /** Default rest between sets, seconds. */
  restSeconds: number;
  warmupStrategy: WarmupStrategy;
  /** Smith bar weight, kg. */
  barWeightKg: number;
  theme: ThemeName;
  /** Available plates, kg, per side, heaviest first. */
  plateSetKg: number[];
  /** Opt-in: add +2 sets for the lagging muscle at workout start. */
  weakPointInjector: boolean;
  /** Spoken rest-timer cues. */
  voiceCues: boolean;
  /** Exercises pinned to analytics/dashboard (Wave 2, G4-30). Undefined = none. */
  pinnedExerciseIds?: string[];
}

export const DEFAULT_PROFILE_SETTINGS: Readonly<ProfileSettings> = Object.freeze({
  units: 'kg',
  language: 'hr',
  restSeconds: 90,
  warmupStrategy: 'standard',
  barWeightKg: 20,
  theme: 'tactical',
  plateSetKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  weakPointInjector: false,
  voiceCues: false,
});

/**
 * A family member on this device. `accountId` is the Supabase auth uid when
 * the device is signed in; family profiles are **not** a security boundary.
 */
export interface Profile {
  id: string;
  name: string;
  accountId?: string;
  /** Tailwind colour token or hex, for the avatar chip. */
  avatarColor?: string;
  activeProgramId: string | null;
  settings: ProfileSettings;
  bodyweightKg?: number;
  gender?: Gender;
  experienceLevel?: ExperienceLevel;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Records owned by a profile ──────────────────────────────────────────────

export type PRType = 'e1rm' | 'weight' | 'reps' | 'volume';

export interface PRRecord {
  id: string;
  profileId: string;
  exerciseId: string;
  exerciseName: string;
  prType: PRType;
  /** The value compared for this PR type (e1RM kg, kg, reps or kg×reps). */
  value: number;
  kg: number;
  reps: number;
  achievedAt: string;
  workoutLogId: string;
  setId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BodyweightEntry {
  id: string;
  profileId: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  valueKg: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Per-profile TYTAX machine setup for one exercise, free text per field (e.g. pin "4", bench "30°"). */
export interface MachineSetup {
  seat?: string;
  pin?: string;
  backrest?: string;
  benchAngle?: string;
  cable?: string;
  other?: string;
}

export interface ExerciseNote {
  id: string;
  profileId: string;
  exerciseId: string;
  content: string;
  /** Machine setup shown at workout time (Wave 2). */
  setup?: MachineSetup;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A favourite exercise ("Arsenal"). */
export interface ArsenalEntry {
  id: string;
  profileId: string;
  exerciseId: string;
  addedAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** What a profile owns at home. One row per profile (`id === profileId`). */
export interface EquipmentInventory {
  id: string;
  profileId: string;
  /** Station ids from the catalog. */
  stationIds: string[];
  attachmentIds: string[];
  kettlebellsKg: number[];
  bodyweightGear: EquipmentRequirement[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Analytics value types ───────────────────────────────────────────────────

export type ACWRStatus = 'fresh' | 'recovering' | 'fried';

export interface ACWRResult {
  muscle: string;
  /** Load over the last 7 days. */
  acuteLoad: number;
  /** Mean weekly load over the last 28 days. */
  chronicLoad: number;
  ratio: number;
  status: ACWRStatus;
  trend: 'rising' | 'stable' | 'falling';
}

export interface GapAnalysis {
  muscle: string;
  idealPercent: number;
  actualPercent: number;
  gap: number;
  isLagging: boolean;
  suggestedExercises: string[];
}

export interface VolumeDataPoint {
  /** "2026-W12". */
  week: string;
  totalVolumeKg: number;
  sessionCount: number;
  muscleBreakdown: Record<string, number>;
}

export interface E1RMDataPoint {
  date: string;
  e1rm: number;
  weight: number;
  reps: number;
}

export interface WarmupSet {
  percent: number;
  reps: number;
  weight: number;
  label: string;
}

// ─── Legacy shapes (Dexie v2 / tytax-autonomous); read-only, for migration ────

/** @deprecated Dexie v2 per-exercise log (sets keyed by `exerciseRef`). Migration input only. */
export interface LegacyExerciseLogV2 {
  exerciseRef: string;
  exerciseName: string;
  modality: string;
  supersetGroup?: string;
  sets: Array<{
    id: string;
    setNumber: number;
    type: SetType;
    kg: number;
    reps: number;
    rir?: number;
    tempo?: string;
    done: boolean;
    isPersonalRecord?: boolean;
    e1rm?: number;
    timestamp: string;
  }>;
  restSeconds?: number;
  notes?: string;
  muscleImpactSnapshot?: MuscleImpact[];
}

/** @deprecated Dexie v2 workout log. Migration input only. */
export interface LegacyWorkoutLogV2 {
  id: string;
  profileId: string;
  familyMemberId?: string;
  programId?: string;
  sessionName: string;
  date: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds: number;
  exercises: LegacyExerciseLogV2[];
  notes?: string;
  rpe?: number;
  bodyweightKg?: number;
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
  modalitiesUsed: string[];
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  syncedAt?: string;
}

/** @deprecated Dexie v2 program (boolean `isActive`). Migration input only. */
export type LegacyProgramV2 = Omit<Program, 'modalitiesUsed' | 'sessions'> & {
  isActive: boolean;
  modalitiesUsed: string[];
  sessions: Array<Omit<ProgramSession, 'exercises'> & { exercises: Array<Omit<ProgramExercise, 'modality'> & { modality: string }> }>;
};

/** @deprecated Dexie v2 user profile. Migration input only. */
export interface LegacyUserProfileV2 {
  id: string;
  displayName: string;
  language: 'en' | 'hr';
  unitSystem: 'metric' | 'imperial';
  theme: 'tactical' | 'oled';
  bodyweightKg?: number;
  gender?: Gender;
  experienceLevel?: ExperienceLevel;
  activeFamilyMemberId?: string;
  activeEquipmentProfileId?: string;
  warmupStrategy: 'standard' | 'heavy' | 'pyramid';
  autoBackup: boolean;
  barWeightKg: number;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}
