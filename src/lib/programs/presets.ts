import type { ProgramTemplate } from '@/contracts/domain';
import { TYTAX_ELITE_V3, TYTAX_ORIGINAL_6DAY, TYTAX_ORIGINAL_6DAY_PRESET_ID } from '@/data/tytax/presets';
import { BW_FUNDAMENTALS } from '@/data/bodyweight/presets';
import { KB_SIMPLE_SINISTER, KB_HYPERTROPHY, KB_CONDITIONING } from '@/data/kettlebell/presets';

/** Stable preset id of the default TYTAX program: the original 6-day split + rest day. */
export const DEFAULT_TYTAX_PRESET_ID = TYTAX_ORIGINAL_6DAY_PRESET_ID;

/** Every built-in program template; each has a stable, unique `presetId`. */
export const ALL_PRESETS: ProgramTemplate[] = [
  TYTAX_ORIGINAL_6DAY,
  TYTAX_ELITE_V3,
  BW_FUNDAMENTALS,
  KB_SIMPLE_SINISTER,
  KB_HYPERTROPHY,
  KB_CONDITIONING,
];

/** Find a built-in template by its stable `presetId`. */
export function getPresetById(presetId: string): ProgramTemplate | undefined {
  return ALL_PRESETS.find((p) => p.presetId === presetId);
}

/** Stable preset ids of the kettlebell programs (UI: detect "already installed"). */
export const KB_PRESET_IDS: readonly string[] = [KB_SIMPLE_SINISTER, KB_HYPERTROPHY, KB_CONDITIONING].map(
  (p) => p.presetId ?? '',
);
