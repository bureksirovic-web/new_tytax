import type { BackupV3 } from '@/contracts/repo';

/** 50 MB: far above a realistic family backup, low enough to refuse junk before parsing. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export type BackupProblem = 'too_large' | 'invalid_json' | 'unsafe' | 'unrecognized' | 'structure';

export const BACKUP_PROBLEM_KEY = {
  too_large: 'set_import_error_too_large',
  invalid_json: 'set_import_error_invalid_json',
  unsafe: 'set_import_error_unsafe',
  unrecognized: 'set_import_error_unrecognized',
  structure: 'set_import_error_structure',
} as const satisfies Record<BackupProblem, string>;

const TABLE_KEYS = [
  'profiles',
  'workoutLogs',
  'programs',
  'prRecords',
  'bodyweightEntries',
  'exerciseNotes',
  'arsenal',
  'equipment',
] as const satisfies readonly (keyof BackupV3)[];

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface BackupCounts {
  profiles: number;
  logs: number;
  programs: number;
  bodyweight: number;
}

export type ParsedBackup =
  | { ok: true; backup: BackupV3; counts: BackupCounts; profileNames: string[] }
  | { ok: false; problem: BackupProblem };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRow = (v: unknown): boolean => isRecord(v) && typeof v.id === 'string' && v.id !== '';
const live = (rows: readonly unknown[]) => rows.filter((r) => isRecord(r) && !r.deletedAt).length;

/**
 * Validates a v3 backup file's text before anything is written: size cap,
 * JSON, no prototype-polluting keys, format/version, every table an array of
 * rows with ids, rows other than profiles carrying a profileId.
 */
export function parseBackupText(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, problem: 'too_large' };
  let unsafe = false;
  let data: unknown;
  try {
    data = JSON.parse(text, (key, value: unknown) => {
      if (UNSAFE_KEYS.has(key)) unsafe = true;
      return value;
    });
  } catch {
    return { ok: false, problem: 'invalid_json' };
  }
  if (unsafe) return { ok: false, problem: 'unsafe' };
  if (!isRecord(data) || data.format !== 'tytax-backup' || data.version !== 3) {
    return { ok: false, problem: 'unrecognized' };
  }
  for (const key of TABLE_KEYS) {
    const rows = data[key];
    if (!Array.isArray(rows) || !rows.every(isRow)) return { ok: false, problem: 'structure' };
    if (key !== 'profiles' && !rows.every((r) => typeof (r as Record<string, unknown>).profileId === 'string')) {
      return { ok: false, problem: 'structure' };
    }
  }
  const backup = data as unknown as BackupV3;
  if (!backup.profiles.every((p) => typeof p.name === 'string' && isRecord(p.settings))) {
    return { ok: false, problem: 'structure' };
  }
  return {
    ok: true,
    backup,
    counts: {
      profiles: live(backup.profiles),
      logs: live(backup.workoutLogs),
      programs: live(backup.programs),
      bodyweight: live(backup.bodyweightEntries),
    },
    profileNames: backup.profiles.filter((p) => !p.deletedAt).map((p) => p.name),
  };
}

/** `tytax_backup_<profile-or-all>_<YYYY-MM-DD>.json`; the name is reduced to safe filename characters. */
export function backupFilename(scope: 'profile' | 'all', profileName: string, day: string): string {
  const slug =
    scope === 'all'
      ? 'all'
      : profileName
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'profile';
  return `tytax_backup_${slug}_${day}.json`;
}
