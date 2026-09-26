/** Translation-key lookups and small formatters shared by the analytics components. */
import type { Units } from '@/contracts/domain';
import { formatDate, fromDisplayWeight, toDisplayWeight, type Locale, type TranslationKey, type TranslationVars } from '@/lib/i18n';
import { parseDay } from './analytics-dates';
import type { AcwrZone, DistributionWindow } from './analytics-math';
import type { MovementPattern } from './exercise-series';

export type TFn = (key: TranslationKey, vars?: TranslationVars) => string;

const MUSCLE_KEYS: Readonly<Record<string, TranslationKey>> = {
  Chest: 'ana_muscle_chest',
  'Front Delts': 'ana_muscle_front_delts',
  'Side Delts': 'ana_muscle_side_delts',
  'Rear Delts': 'ana_muscle_rear_delts',
  'Upper Traps': 'ana_muscle_upper_traps',
  'Mid/Lower Traps': 'ana_muscle_mid_lower_traps',
  Lats: 'ana_muscle_lats',
  Rhomboids: 'ana_muscle_rhomboids',
  Biceps: 'ana_muscle_biceps',
  Triceps: 'ana_muscle_triceps',
  Forearms: 'ana_muscle_forearms',
  Quads: 'ana_muscle_quads',
  Hamstrings: 'ana_muscle_hamstrings',
  Glutes: 'ana_muscle_glutes',
  Calves: 'ana_muscle_calves',
  Core: 'ana_muscle_core',
  'Hip Flexors': 'ana_muscle_hip_flexors',
  Adductors: 'ana_muscle_adductors',
  Abductors: 'ana_muscle_abductors',
  'Spinal Erectors': 'ana_muscle_spinal_erectors',
  Serratus: 'ana_muscle_serratus',
  'Rotator Cuff': 'ana_muscle_rotator_cuff',
  Neck: 'ana_muscle_neck',
};

/** Translated standardised muscle name; unknown names are shown as stored. */
export function muscleLabel(t: TFn, muscle: string): string {
  const key = MUSCLE_KEYS[muscle];
  return key ? t(key) : muscle;
}

export const ZONE_KEYS: Readonly<Record<AcwrZone, TranslationKey>> = {
  undertrain: 'ana_zone_undertrain',
  optimal: 'ana_zone_optimal',
  caution: 'ana_zone_caution',
  danger: 'ana_zone_danger',
};

export const WINDOW_KEYS: Readonly<Record<DistributionWindow, TranslationKey>> = {
  '7d': 'ana_window_7d',
  '30d': 'ana_window_30d',
  '20s': 'ana_window_20s',
};

export const PATTERN_KEYS: Readonly<Record<MovementPattern, TranslationKey>> = {
  push: 'ana_pattern_push',
  pull: 'ana_pattern_pull',
  quad: 'ana_pattern_quad',
  hinge: 'ana_pattern_hinge',
  carry: 'ana_pattern_carry',
  core: 'ana_pattern_core',
  other: 'ana_pattern_other',
};

/** Plural category: hr 1 / 2–4 / 5+ (with the 11–14 exception), en 1 / other. */
export function pluralForm(count: number, locale: Locale): 'one' | 'few' | 'many' {
  const n = Math.abs(Math.trunc(count));
  if (locale === 'en') return n === 1 ? 'one' : 'many';
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return 'one';
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return 'few';
  return 'many';
}

export function sessionsLabel(t: TFn, locale: Locale, count: number): string {
  const form = pluralForm(count, locale);
  const key: TranslationKey = form === 'one' ? 'ana_sessions_one' : form === 'few' ? 'ana_sessions_few' : 'ana_sessions_many';
  return t(key, { count });
}

/** 'YYYY-MM-DD' as a short local date ("26. ruj" / "26 Sept"). */
export function dayLabel(day: string, locale: Locale, withYear = false): string {
  const opts: Intl.DateTimeFormatOptions = withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
  return formatDate(parseDay(day), locale, opts);
}

/** Localised number with at most `digits` decimals. */
export function num(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(locale === 'hr' ? 'hr-HR' : 'en-GB', { maximumFractionDigits: digits }).format(value);
}

// ─── Bodyweight input ────────────────────────────────────────────────────────

export const BW_MIN_KG = 20;
export const BW_MAX_KG = 400;

export type BodyweightParse = { ok: true; kg: number } | { ok: false };

/**
 * Parse a bodyweight typed in `unit` ("80,5" and "80.5" both work) into kg.
 * Valid range 20–400 kg (checked after conversion, so 44.1–881.8 lb).
 */
export function parseBodyweight(input: string, unit: Units): BodyweightParse {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false };
  const kg = fromDisplayWeight(Number(text), unit);
  if (!(kg >= BW_MIN_KG && kg <= BW_MAX_KG)) return { ok: false };
  return { ok: true, kg };
}

/** A kg value as the number shown in an input for `unit`. */
export function toInputValue(kg: number, unit: Units): string {
  return String(toDisplayWeight(kg, unit));
}
