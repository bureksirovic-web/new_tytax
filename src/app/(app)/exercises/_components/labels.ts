/**
 * Pure label/key helpers for the exercises screens: map catalog ids and raw
 * muscle names to i18n keys in the `ex_` module. Unknown ids return undefined
 * so callers can fall back to the catalog's own display name.
 */
import type { Modality, MuscleGroup } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';
import { standardizeMuscle } from '@/lib/constants';

export const MUSCLE_GROUP_OPTIONS: readonly MuscleGroup[] = [
  'CHEST',
  'BACK_VERTICAL',
  'BACK_HORIZONTAL',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'FOREARMS_GRIP',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
];

export const MODALITY_OPTIONS = ['tytax', 'bodyweight', 'kettlebell'] as const;
export type LibraryModality = (typeof MODALITY_OPTIONS)[number];

const MODALITY_KEYS: Record<Modality, TranslationKey> = {
  tytax: 'ex_modality_tytax',
  bodyweight: 'ex_modality_bodyweight',
  kettlebell: 'ex_modality_kettlebell',
  custom: 'ex_modality_custom',
};

const MUSCLE_GROUP_KEYS: Record<MuscleGroup, TranslationKey> = {
  CHEST: 'ex_muscle_chest',
  BACK_VERTICAL: 'ex_muscle_back_vertical',
  BACK_HORIZONTAL: 'ex_muscle_back_horizontal',
  SHOULDERS: 'ex_muscle_shoulders',
  BICEPS: 'ex_muscle_biceps',
  TRICEPS: 'ex_muscle_triceps',
  FOREARMS_GRIP: 'ex_muscle_forearms_grip',
  QUADS: 'ex_muscle_quads',
  HAMSTRINGS: 'ex_muscle_hamstrings',
  GLUTES: 'ex_muscle_glutes',
  CALVES: 'ex_muscle_calves',
  CORE: 'ex_muscle_core',
};

/** The seven catalog stations use G1's `station_*` keys; `tytax` is a pre-library id. */
const STATION_KEYS: Record<string, TranslationKey> = {
  smith: 'station_SMITH',
  'back-upper': 'station_BACK_UPPER',
  'back-lower': 'station_BACK_LOWER',
  'leg-extension': 'station_LEG_EXTENSION',
  'leg-curl': 'station_LEG_CURL',
  frame: 'station_FRAME',
  'free-weight': 'station_FREE_WEIGHT',
  tytax: 'ex_station_tytax',
};

const ATTACHMENT_KEYS: Record<string, TranslationKey> = {
  rope: 'ex_att_rope',
  'v-bar': 'ex_att_v_bar',
  'straight-bar': 'ex_att_straight_bar',
  'd-handle': 'ex_att_d_handle',
  'ankle-strap': 'ex_att_ankle_strap',
  belt: 'ex_att_belt',
  'lat-bar': 'ex_att_lat_bar',
  'ez-bar': 'ex_att_ez_bar',
  'row-handle': 'ex_att_row_handle',
  // tytax_library.json keys, normalised (TRICEPS_ROPE → triceps-rope)
  'triceps-rope': 'ex_att_rope',
  'v-handle': 'ex_att_v_bar',
  'd-handles': 'ex_att_d_handle',
  'dip-belt': 'ex_att_belt',
  'ez-lat-bar': 'ex_att_ez_bar',
};

/** Standardised muscle name (src/lib/constants MUSCLE_GROUPS) → key. */
const MUSCLE_DETAIL_KEYS: Record<string, TranslationKey> = {
  Chest: 'ex_mdetail_chest',
  'Front Delts': 'ex_mdetail_front_delts',
  'Side Delts': 'ex_mdetail_side_delts',
  'Rear Delts': 'ex_mdetail_rear_delts',
  'Upper Traps': 'ex_mdetail_upper_traps',
  'Mid/Lower Traps': 'ex_mdetail_mid_lower_traps',
  Lats: 'ex_mdetail_lats',
  Rhomboids: 'ex_mdetail_rhomboids',
  Biceps: 'ex_mdetail_biceps',
  Triceps: 'ex_mdetail_triceps',
  Forearms: 'ex_mdetail_forearms',
  Quads: 'ex_mdetail_quads',
  Hamstrings: 'ex_mdetail_hamstrings',
  Glutes: 'ex_mdetail_glutes',
  Calves: 'ex_mdetail_calves',
  Core: 'ex_mdetail_core',
  'Hip Flexors': 'ex_mdetail_hip_flexors',
  Adductors: 'ex_mdetail_adductors',
  Abductors: 'ex_mdetail_abductors',
  'Spinal Erectors': 'ex_mdetail_spinal_erectors',
  Serratus: 'ex_mdetail_serratus',
  'Rotator Cuff': 'ex_mdetail_rotator_cuff',
  Neck: 'ex_mdetail_neck',
};

export const modalityKey = (m: Modality): TranslationKey => MODALITY_KEYS[m];
export const muscleGroupKey = (g: MuscleGroup): TranslationKey => MUSCLE_GROUP_KEYS[g];
/** Catalog ids are matched lower-case with `_` → `-`, so library keys (`BACK_UPPER`) and older ids (`back-upper`) both resolve. */
const normId = (id: string): string => id.toLowerCase().replace(/_/g, '-');
export const stationKey = (id: string): TranslationKey | undefined => STATION_KEYS[normId(id)];
export const attachmentKey = (id: string): TranslationKey | undefined => ATTACHMENT_KEYS[normId(id)];
export const impactMuscleKey = (raw: string): TranslationKey | undefined => MUSCLE_DETAIL_KEYS[standardizeMuscle(raw)];

export function isMuscleGroup(v: string | null | undefined): v is MuscleGroup {
  return v != null && (MUSCLE_GROUP_OPTIONS as readonly string[]).includes(v);
}

export function isLibraryModality(v: string | null | undefined): v is LibraryModality {
  return v != null && (MODALITY_OPTIONS as readonly string[]).includes(v);
}

export type ImpactLevel = 'primary' | 'secondary' | 'tertiary';

/** Legacy thresholds (L230-232): Primary ≥ 90, Secondary ≥ 50, else Tertiary. */
export function impactLevel(score: number): ImpactLevel {
  if (score >= 90) return 'primary';
  if (score >= 50) return 'secondary';
  return 'tertiary';
}

export const IMPACT_LEVEL_KEYS: Record<ImpactLevel, TranslationKey> = {
  primary: 'ex_impact_primary',
  secondary: 'ex_impact_secondary',
  tertiary: 'ex_impact_tertiary',
};

/** Label helper: translate `key` when known, else show the fallback text. */
export function labelOr(t: (k: TranslationKey) => string, key: TranslationKey | undefined, fallback: string): string {
  return key ? t(key) : fallback;
}
