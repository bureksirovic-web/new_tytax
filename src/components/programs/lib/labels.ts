/**
 * Translation keys for program enums (split, modality, muscle chips, stations).
 */
import type { Modality, SplitType } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';
import type { LoadGroup } from '@/lib/programs/load';
import type { MuscleChip } from '@/lib/programs/session-kind';
import '@/lib/i18n/packs/programs';
import '@/lib/i18n/packs/requests';

export const SPLIT_KEYS: Record<SplitType, TranslationKey> = {
  full_body: 'prog_split_full_body',
  upper_lower: 'prog_split_upper_lower',
  push_pull_legs: 'prog_split_push_pull_legs',
  custom: 'prog_split_custom',
};

export const MODALITY_KEYS: Record<Modality | 'all', TranslationKey> = {
  all: 'prog_mod_all',
  tytax: 'prog_mod_tytax',
  bodyweight: 'prog_mod_bodyweight',
  kettlebell: 'prog_mod_kettlebell',
  custom: 'prog_mod_custom',
};

export const MUSCLE_KEYS: Record<MuscleChip | LoadGroup, TranslationKey> = {
  ALL: 'prog_mus_all',
  CHEST: 'prog_mus_chest',
  BACK: 'prog_mus_back',
  BACK_VERTICAL: 'prog_mus_back_vertical',
  BACK_HORIZONTAL: 'prog_mus_back_horizontal',
  SHOULDERS: 'prog_mus_shoulders',
  BICEPS: 'prog_mus_biceps',
  TRICEPS: 'prog_mus_triceps',
  FOREARMS_GRIP: 'prog_mus_forearms_grip',
  QUADS: 'prog_mus_quads',
  HAMSTRINGS: 'prog_mus_hamstrings',
  GLUTES: 'prog_mus_glutes',
  CALVES: 'prog_mus_calves',
  CORE: 'prog_mus_core',
};

const STATION_KEYS: Record<string, TranslationKey> = {
  smith: 'prog_station_smith',
  'back-upper': 'prog_station_back_upper',
  'back-lower': 'prog_station_back_lower',
  'leg-extension': 'prog_station_leg_extension',
  'leg-curl': 'prog_station_leg_curl',
  tytax: 'prog_station_tytax',
  // App-level stations added by G1 (catalog.stations FRAME / FREE_WEIGHT): G1's station_* keys.
  frame: 'station_FRAME',
  'free-weight': 'station_FREE_WEIGHT',
};

/** Key for a station id (catalog ids are lower-case; the library's upper-case keys map too). */
export function stationKey(stationId: string): TranslationKey | undefined {
  return STATION_KEYS[stationId.toLowerCase().replace(/_/g, '-')];
}
