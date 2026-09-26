/**
 * Profile settings: merge a patch over stored (or default) settings and
 * validate the result. Every bad value is `RepoError('VALIDATION')`.
 */
import { DEFAULT_PROFILE_SETTINGS, type ProfileSettings } from '@/contracts/domain';
import { RepoError } from '@/contracts/repo';
import { compact } from './rows';
import { assertPositive } from './validate';

export const MAX_REST_SECONDS = 3600;
export const MAX_BAR_WEIGHT_KG = 100;
export const MAX_PLATES = 20;
export const MAX_PINNED_EXERCISES = 4;

/** Optional keys that have no default (absent = none). */
const OPTIONAL_KEYS = ['pinnedExerciseIds'] as const;
const SETTING_KEYS: ReadonlySet<string> = new Set([...Object.keys(DEFAULT_PROFILE_SETTINGS), ...OPTIONAL_KEYS]);

const ENUMS: Readonly<Record<'units' | 'language' | 'warmupStrategy' | 'theme', ReadonlySet<string>>> = {
  units: new Set(['kg', 'lb']),
  language: new Set(['hr', 'en']),
  warmupStrategy: new Set(['standard', 'heavy', 'pyramid', 'none']),
  theme: new Set(['tactical', 'oled']),
};

function invalid(message: string): RepoError {
  return new RepoError('VALIDATION', message);
}

function assertRange(v: unknown, field: string, min: number, max: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw invalid(`settings.${field} must be a number in ${min}..${max}`);
  }
}

export function validateSettings(s: ProfileSettings): void {
  for (const [field, allowed] of Object.entries(ENUMS)) {
    const value: unknown = s[field as keyof typeof ENUMS];
    if (typeof value !== 'string' || !allowed.has(value)) {
      throw invalid(`settings.${field} must be one of ${[...allowed].join(', ')}`);
    }
  }
  assertRange(s.restSeconds, 'restSeconds', 0, MAX_REST_SECONDS);
  if (!Number.isInteger(s.restSeconds)) throw invalid('settings.restSeconds must be whole seconds');
  assertRange(s.barWeightKg, 'barWeightKg', 0, MAX_BAR_WEIGHT_KG);
  if (!Array.isArray(s.plateSetKg) || s.plateSetKg.length > MAX_PLATES) {
    throw invalid(`settings.plateSetKg must be an array of at most ${MAX_PLATES} plates`);
  }
  s.plateSetKg.forEach((p) => assertPositive(p, 'settings.plateSetKg[]'));
  if (typeof s.weakPointInjector !== 'boolean') throw invalid('settings.weakPointInjector must be a boolean');
  if (typeof s.voiceCues !== 'boolean') throw invalid('settings.voiceCues must be a boolean');
  assertPinned(s.pinnedExerciseIds);
}

/** Wave 2 (G4-30): undefined, or 1..4 unique non-empty exercise ids in display order. */
function assertPinned(v: unknown): void {
  if (v === undefined) return;
  if (!Array.isArray(v) || v.length > MAX_PINNED_EXERCISES) {
    throw invalid(`settings.pinnedExerciseIds must be an array of at most ${MAX_PINNED_EXERCISES} ids`);
  }
  if (v.some((x) => typeof x !== 'string' || x.trim() === '')) {
    throw invalid('settings.pinnedExerciseIds must hold non-empty strings');
  }
  if (new Set(v).size !== v.length) throw invalid('settings.pinnedExerciseIds must not repeat an id');
}

function assertKnownKeys(patch: unknown): asserts patch is Partial<ProfileSettings> {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw invalid('settings must be an object');
  }
  for (const key of Object.keys(patch)) {
    if (!SETTING_KEYS.has(key)) throw invalid(`settings.${key} is not a known setting`);
  }
}

/**
 * A stored pin list made valid: non-empty string ids, first occurrence kept,
 * at most `MAX_PINNED_EXERCISES`; anything else (null, non-array) or an empty
 * result is `undefined`. Stored rows can hold bad pins because importBackup /
 * applyRemote store settings verbatim (the zod profile schema strips no pins).
 */
export function sanitizePins(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  const unique = [...new Set(ids)].slice(0, MAX_PINNED_EXERCISES);
  return unique.length > 0 ? unique : undefined;
}

/**
 * `base` overlaid with `patch` (undefined values ignored), validated.
 * `plateSetKg` is always a fresh array, heaviest first.
 * `pinnedExerciseIds` present in the patch as `null` or `undefined` (or `[]`)
 * clears the pins; otherwise it is copied with its order kept. The base's own
 * pins are sanitised first, so a bad stored list never blocks an unrelated patch.
 */
export function mergeSettings(base: ProfileSettings, patch?: Partial<ProfileSettings>): ProfileSettings {
  const clean = patch === undefined ? {} : patch;
  assertKnownKeys(clean);
  const pins: unknown = 'pinnedExerciseIds' in clean ? clean.pinnedExerciseIds : 'absent';
  const clearPins = pins === undefined || pins === null || (Array.isArray(pins) && pins.length === 0);
  const baseClean: ProfileSettings = { ...base };
  const basePins = sanitizePins(base.pinnedExerciseIds);
  if (basePins) baseClean.pinnedExerciseIds = basePins;
  else delete baseClean.pinnedExerciseIds;
  const merged: ProfileSettings = { ...baseClean, ...compact(clean) };
  if (clearPins) delete merged.pinnedExerciseIds;
  validateSettings(merged);
  merged.plateSetKg = [...merged.plateSetKg].sort((a, b) => b - a);
  if (merged.pinnedExerciseIds) merged.pinnedExerciseIds = [...merged.pinnedExerciseIds];
  return merged;
}

/** Fresh defaults (arrays never shared with `DEFAULT_PROFILE_SETTINGS`). */
export function defaultSettings(): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg] };
}
