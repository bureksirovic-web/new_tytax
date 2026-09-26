import { DEFAULT_PROFILE_SETTINGS, type ProfileSettings } from '@/contracts/domain';
import { mergeSettings } from '@/lib/db/repo/profiles';

/**
 * Row-level checks for a v3 backup, before anything is written. The repository's
 * `importBackup` stores rows as-is, so a row the history screens cannot render
 * (no exercises, no date, NaN totals) would otherwise brick /history.
 */
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || v === null || check(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isSet(v: unknown): boolean {
  return isRecord(v) && isNum(v.kg) && isNum(v.reps) && typeof v.done === 'boolean' && optional(v.rir, isNum) && optional(v.durationSeconds, isNum);
}

function isExercise(v: unknown): boolean {
  return isRecord(v) && isStr(v.exerciseName) && Array.isArray(v.sets) && v.sets.every(isSet);
}

/** A workout log row every history/dashboard view can render. */
export function isValidLogRow(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    isStr(v.date) &&
    DAY.test(v.date) &&
    isStr(v.startedAt) &&
    optional(v.finishedAt, isStr) &&
    isNum(v.durationSeconds) &&
    isNum(v.totalVolumeKg) &&
    isNum(v.totalSets) &&
    optional(v.prCount, isNum) &&
    Array.isArray(v.exercises) &&
    v.exercises.every(isExercise)
  );
}

/**
 * Missing settings keys are filled from DEFAULT_PROFILE_SETTINGS (an older or
 * hand-edited backup); a present but invalid value makes the file unusable, so
 * null is returned. The repository's own validator decides what "valid" means.
 */
export function normalizeSettings(raw: Record<string, unknown>): ProfileSettings | null {
  const filled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) if (value !== undefined && value !== null) filled[key] = value;
  try {
    return mergeSettings({ ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg] }, filled as Partial<ProfileSettings>);
  } catch {
    return null;
  }
}

/**
 * Defaults for every settings key a stored profile is missing or holds an
 * invalid value for (a restore from before G4-W2-40). Sent with each settings
 * save, so one damaged key can no longer make every setting unsaveable.
 */
export function settingsRepairs(settings: Partial<ProfileSettings> | undefined): Partial<ProfileSettings> {
  const defaults = { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg] };
  const repairs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    const current = (settings as Record<string, unknown> | undefined)?.[key];
    let ok = current !== undefined && current !== null;
    if (ok) {
      try {
        mergeSettings(defaults, { [key]: current } as Partial<ProfileSettings>);
      } catch {
        ok = false;
      }
    }
    if (!ok) repairs[key] = value;
  }
  return repairs as Partial<ProfileSettings>;
}
