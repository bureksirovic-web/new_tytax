import type { TranslationKey } from '@/lib/i18n';
import type { StandardMuscle } from '@/lib/constants';
import '@/lib/i18n/packs/dashboard';

/** i18n key per standardised catalog muscle (`MUSCLE_GROUPS`). */
export const MUSCLE_KEYS: Readonly<Record<StandardMuscle, TranslationKey>> = {
  Chest: 'dash_muscle_chest',
  'Front Delts': 'dash_muscle_front_delts',
  'Side Delts': 'dash_muscle_side_delts',
  'Rear Delts': 'dash_muscle_rear_delts',
  'Upper Traps': 'dash_muscle_upper_traps',
  'Mid/Lower Traps': 'dash_muscle_mid_lower_traps',
  Lats: 'dash_muscle_lats',
  Rhomboids: 'dash_muscle_rhomboids',
  Biceps: 'dash_muscle_biceps',
  Triceps: 'dash_muscle_triceps',
  Forearms: 'dash_muscle_forearms',
  Quads: 'dash_muscle_quads',
  Hamstrings: 'dash_muscle_hamstrings',
  Glutes: 'dash_muscle_glutes',
  Calves: 'dash_muscle_calves',
  Core: 'dash_muscle_core',
  'Hip Flexors': 'dash_muscle_hip_flexors',
  Adductors: 'dash_muscle_adductors',
  Abductors: 'dash_muscle_abductors',
  'Spinal Erectors': 'dash_muscle_spinal_erectors',
  Serratus: 'dash_muscle_serratus',
  'Rotator Cuff': 'dash_muscle_rotator_cuff',
  Neck: 'dash_muscle_neck',
};

/** Translated muscle name; an unknown (non-standard) name is shown as stored. */
export function muscleLabel(muscle: string, t: (key: TranslationKey) => string): string {
  const key = (MUSCLE_KEYS as Readonly<Record<string, TranslationKey | undefined>>)[muscle];
  return key ? t(key) : muscle;
}
