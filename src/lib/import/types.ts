/**
 * Normalized, contract-independent output of the legacy (tytax-autonomous)
 * import parser. A later step maps these shapes into the v2 repository; this
 * module deliberately knows nothing about Dexie or src/contracts.
 */

export type LegacyFormat = 'app-backup' | 'localstorage-dump';

export type LegacySetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface LegacySet {
  /** Load in kg. A blank legacy value ('' / null / missing) becomes 0. */
  kg: number;
  /** Repetitions. A blank legacy value becomes 0. */
  reps: number;
  /** Reps in reserve. A blank legacy value stays undefined ("not recorded"). */
  rir?: number;
  done: boolean;
  /** Missing legacy type means 'working' (the legacy app's own rule). */
  type: LegacySetType;
}

export interface LegacyExercise {
  /** Exercise name normalized like the legacy app (newlines/whitespace collapsed, trimmed). */
  legacyName: string;
  sets: LegacySet[];
}

export interface LegacyLog {
  /** Stable id: String(legacy id), or a deterministic fallback derived from position. */
  sourceId: string;
  /** Calendar day, YYYY-MM-DD. */
  date: string;
  /** ISO datetime when derivable (ISO date input, or epoch-ms id minus duration). */
  startedAt?: string;
  /** ISO datetime when derivable (epoch-ms id: the legacy app set id = Date.now() on finish). */
  finishedAt?: string;
  sessionName: string;
  durationSeconds: number;
  rpe?: number;
  notes?: string;
  isDeload?: boolean;
  /** In legacy order; the same legacyName may appear more than once. */
  exercises: LegacyExercise[];
}

export interface LegacyBodyweight {
  date: string;
  kg: number;
}

export interface LegacyProtocol {
  sourceId: string;
  name: string;
  description?: string;
  plan: Record<string, string[]>;
  order: string[];
}

export interface LegacySettings {
  warmupStrategy?: string;
  oledMode?: boolean;
  language?: 'hr' | 'en';
  barWeightKg?: number;
  startDate?: string;
  pinnedMetrics?: string[];
  inventory?: string[];
  autoBackup?: boolean;
}

export interface LegacyUserData {
  /** Legacy username; 'default' for single-user dumps and app backups. */
  username: string;
  logs: LegacyLog[];
  trainingPlan: Record<string, string[]>;
  sessionOrder: string[];
  bodyweight: LegacyBodyweight[];
  customProtocols: LegacyProtocol[];
  settings: LegacySettings;
}

export type ImportWarningCode =
  | 'UNSAFE_KEY_STRIPPED'
  | 'INVALID_RECORD'
  | 'INVALID_SET'
  | 'INVALID_VALUE'
  | 'INVALID_JSON_VALUE'
  | 'UNKNOWN_KEY'
  | 'UNKNOWN_SET_TYPE'
  | 'DUPLICATE_LOG_ID'
  | 'LEGACY_LEFTOVER_IGNORED'
  | 'SHARED_CUSTOM_PROTOCOLS'
  | 'USER_NOT_IN_LIST'
  | 'EMPTY_USERNAME';

export interface ImportWarning {
  code: ImportWarningCode;
  /** Dotted/bracketed location in the input, e.g. "tytax_logs_Ana[3].exercises[0]". */
  path: string;
  message: string;
}

export interface LegacySharedData {
  /**
   * Un-suffixed tytax_custom_protocols in a multi-user dump. The legacy app
   * sometimes wrote it without the user suffix, so it cannot be attributed.
   */
  customProtocols: LegacyProtocol[];
  /** Device-global settings (tytax_bar_weight / tytax_language written un-suffixed). */
  settings: Pick<LegacySettings, 'barWeightKg' | 'language'>;
}

export interface LegacyImportBundle {
  format: LegacyFormat;
  users: LegacyUserData[];
  shared: LegacySharedData;
  warnings: ImportWarning[];
}

export interface ParseOptions {
  /** Byte cap for the whole input and for each nested JSON string. Default 20 MiB. */
  maxBytes?: number;
  /** Maximum nesting depth of any parsed JSON value. Default 64. */
  maxDepth?: number;
  /** 'strip' (default): drop __proto__/constructor/prototype keys with a warning. 'throw': ImportError UNSAFE_KEYS. */
  unsafeKeys?: 'strip' | 'throw';
  /** Username for an app-backup (which carries none). Default 'default'. */
  backupUsername?: string;
}

export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_MAX_DEPTH = 64;
export const DEFAULT_USERNAME = 'default';
