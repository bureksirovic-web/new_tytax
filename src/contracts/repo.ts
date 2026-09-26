/**
 * TYTAX v2 — frozen repository contract (Wave 0, 2026-09-26).
 *
 * Only `src/lib/db/**` implements this (Dexie). UI, stores and hooks never
 * touch Dexie directly; they go through `getRepository()` and the hooks in
 * `src/hooks/use-repo.ts`.
 *
 * Rules every implementation keeps:
 * - Every read and write is scoped by `profileId`.
 * - Reads hide soft-deleted rows unless `includeDeleted` is set.
 * - Mutations stamp `updatedAt`; creates stamp `createdAt`.
 * - When the sync adapter is enabled, every mutation queues a
 *   `SyncOperation` in the same transaction.
 * - Failures throw `RepoError` with a typed `code`.
 */

import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  ExerciseNote,
  PRRecord,
  PRType,
  Profile,
  ProfileSettings,
  Program,
  ProgramTemplate,
  WorkoutDebrief,
  WorkoutDraft,
  WorkoutLog,
} from './domain';
import type { ApplyRemoteResult, SyncOutbox, SyncTable } from './sync';
import type { PRCandidate } from './training';

export type Unsubscribe = () => void;

export interface ListOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/** Inclusive calendar-day range, 'YYYY-MM-DD'. */
export interface DateRange {
  from?: string;
  to?: string;
}

export type RepoErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NO_ACTIVE_PROFILE'
  | 'STORAGE'
  | 'NOT_IMPLEMENTED';

export class RepoError extends Error {
  readonly code: RepoErrorCode;
  readonly cause?: unknown;

  constructor(code: RepoErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'RepoError';
    this.code = code;
    this.cause = cause;
  }
}

export function isRepoError(e: unknown, code?: RepoErrorCode): e is RepoError {
  return e instanceof RepoError && (code === undefined || e.code === code);
}

// ─── Per-entity repositories ─────────────────────────────────────────────────

export interface CreateProfileInput {
  name: string;
  settings?: Partial<ProfileSettings>;
  avatarColor?: string;
  accountId?: string;
}

export interface ProfilesRepo {
  list(opts?: ListOptions): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  create(input: CreateProfileInput): Promise<Profile>;
  update(id: string, patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'settings'>>): Promise<Profile>;
  updateSettings(id: string, patch: Partial<ProfileSettings>): Promise<Profile>;
  /**
   * Deletes the profile and wipes every record it owns (tombstoned for sync
   * when enabled). Never touches another profile. If it was the active
   * profile, another remaining profile becomes active (or none).
   */
  remove(id: string): Promise<void>;
  /** The profile selected on this device, or null. */
  getActiveId(): Promise<string | null>;
  setActive(id: string): Promise<void>;
  /** Returns the active profile, creating and activating `defaultName` when none exists. */
  ensureActive(defaultName: string): Promise<Profile>;
}

export interface LogsRepo {
  /** Newest first (date desc, then startedAt desc). */
  list(profileId: string, opts?: ListOptions & DateRange): Promise<WorkoutLog[]>;
  get(profileId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<WorkoutLog | undefined>;
  /** Edit a finished log; totals are recomputed from `exercises`. */
  update(profileId: string, id: string, patch: Partial<Omit<WorkoutLog, 'id' | 'profileId' | 'createdAt'>>): Promise<WorkoutLog>;
  softDelete(profileId: string, id: string): Promise<void>;
  /** Undo of `softDelete`. */
  restore(profileId: string, id: string): Promise<void>;
  /** Logs containing `exerciseId`, newest first. */
  historyFor(profileId: string, exerciseId: string, opts?: ListOptions): Promise<WorkoutLog[]>;
  count(profileId: string, opts?: { includeDeleted?: boolean }): Promise<number>;
}

export interface ProgramsRepo {
  list(profileId: string, opts?: ListOptions): Promise<Program[]>;
  get(profileId: string, id: string): Promise<Program | undefined>;
  /** Installs a template (preset or builder output) as a new program. */
  create(profileId: string, template: ProgramTemplate, opts?: { activate?: boolean }): Promise<Program>;
  update(profileId: string, id: string, patch: Partial<Omit<Program, 'id' | 'profileId' | 'createdAt'>>): Promise<Program>;
  softDelete(profileId: string, id: string): Promise<void>;
  /** The profile's active program (via `Profile.activeProgramId`), if any. */
  getActive(profileId: string): Promise<Program | undefined>;
  setActive(profileId: string, programId: string | null): Promise<void>;
  /** Moves the rotation pointer to the next session (wraps around). */
  advance(profileId: string, programId: string): Promise<Program>;
}

export interface PRsRepo {
  list(profileId: string, opts?: ListOptions & { exerciseId?: string }): Promise<PRRecord[]>;
  /** Best record per PR type for one exercise. */
  best(profileId: string, exerciseId: string): Promise<Partial<Record<PRType, PRRecord>>>;
}

export interface BodyweightRepo {
  /** Newest first. */
  list(profileId: string, opts?: ListOptions & DateRange): Promise<BodyweightEntry[]>;
  add(profileId: string, input: { date: string; valueKg: number }): Promise<BodyweightEntry>;
  update(profileId: string, id: string, patch: { date?: string; valueKg?: number }): Promise<BodyweightEntry>;
  softDelete(profileId: string, id: string): Promise<void>;
}

export interface NotesRepo {
  get(profileId: string, exerciseId: string): Promise<ExerciseNote | undefined>;
  /** Upsert; an empty string soft-deletes the note. */
  set(profileId: string, exerciseId: string, content: string): Promise<ExerciseNote | undefined>;
  list(profileId: string, opts?: ListOptions): Promise<ExerciseNote[]>;
}

export interface ArsenalRepo {
  list(profileId: string, opts?: ListOptions): Promise<ArsenalEntry[]>;
  has(profileId: string, exerciseId: string): Promise<boolean>;
  add(profileId: string, exerciseId: string): Promise<ArsenalEntry>;
  remove(profileId: string, exerciseId: string): Promise<void>;
}

export interface EquipmentRepo {
  /** Returns a default (empty) inventory when none is stored. */
  get(profileId: string): Promise<EquipmentInventory>;
  save(profileId: string, patch: Partial<Omit<EquipmentInventory, 'id' | 'profileId' | 'createdAt'>>): Promise<EquipmentInventory>;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export interface FinishResult {
  log: WorkoutLog;
  /** Every PR the workout produced, baselines included (see `PRCandidate.isBaseline`). */
  prs: PRCandidate[];
  /** True when this draft id had already been finished; nothing was written again. */
  alreadyFinished: boolean;
  /** Present when the draft belonged to a program and its rotation advanced. */
  advancedProgram?: { programId: string; nextSessionIndex: number };
}

/** Full local backup, used by JSON backup/restore (G2). */
export interface BackupV3 {
  format: 'tytax-backup';
  version: 3;
  exportedAt: string;
  profiles: Profile[];
  workoutLogs: WorkoutLog[];
  programs: Program[];
  prRecords: PRRecord[];
  bodyweightEntries: BodyweightEntry[];
  exerciseNotes: ExerciseNote[];
  arsenal: ArsenalEntry[];
  equipment: EquipmentInventory[];
}

export interface Repository {
  readonly profiles: ProfilesRepo;
  readonly logs: LogsRepo;
  readonly programs: ProgramsRepo;
  readonly prs: PRsRepo;
  readonly bodyweight: BodyweightRepo;
  readonly notes: NotesRepo;
  readonly arsenal: ArsenalRepo;
  readonly equipment: EquipmentRepo;
  /** Sync outbox (drained by the sync adapter). */
  readonly outbox: SyncOutbox;

  /**
   * Atomic and idempotent. In one transaction: writes the log (id = draft.id),
   * detects PRs over done working sets and writes them, advances the program
   * rotation when `draft.programId` is set, and queues sync ops. Calling it
   * again with the same draft id writes nothing and returns
   * `alreadyFinished: true` with the stored log.
   */
  finishWorkout(draft: WorkoutDraft, debrief?: WorkoutDebrief): Promise<FinishResult>;

  /** Runs `fn` in one read-write transaction over all tables; repo calls inside join it. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Live query: runs `query` now and again whenever the data it read changes.
   * Returns an unsubscribe function.
   */
  watch<T>(query: () => Promise<T>, onNext: (value: T) => void, onError?: (e: unknown) => void): Unsubscribe;

  /** Export one profile (or all when omitted), soft-deleted rows included. */
  exportBackup(profileId?: string): Promise<BackupV3>;
  /** Restore a backup in one transaction; idempotent by record id. */
  importBackup(backup: BackupV3): Promise<{ inserted: number; updated: number }>;

  /** Apply pulled rows (camelCase, already mapped) with last-write-wins on `updatedAt`. */
  applyRemote(table: SyncTable, records: readonly Record<string, unknown>[]): Promise<ApplyRemoteResult>;

  /** Test/e2e only: wipe every table. */
  resetAll(): Promise<void>;
}
