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

const SETTING_KEYS: ReadonlySet<string> = new Set(Object.keys(DEFAULT_PROFILE_SETTINGS));

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
 * `base` overlaid with `patch` (undefined values ignored), validated.
 * `plateSetKg` is always a fresh array, heaviest first.
 */
export function mergeSettings(base: ProfileSettings, patch?: Partial<ProfileSettings>): ProfileSettings {
  const clean = patch === undefined ? {} : patch;
  assertKnownKeys(clean);
  const merged: ProfileSettings = { ...base, ...compact(clean) };
  validateSettings(merged);
  merged.plateSetKg = [...merged.plateSetKg].sort((a, b) => b - a);
  return merged;
}

/** Fresh defaults (arrays never shared with `DEFAULT_PROFILE_SETTINGS`). */
export function defaultSettings(): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg] };
}
