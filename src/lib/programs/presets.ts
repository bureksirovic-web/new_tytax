import type { Program } from '@/types/program';
import { TYTAX_ELITE_V3 } from '@/data/tytax/presets';
import { BW_FUNDAMENTALS } from '@/data/bodyweight/presets';
import { KB_SIMPLE_SINISTER, KB_HYPERTROPHY, KB_CONDITIONING } from '@/data/kettlebell/presets';

/**
 * All built-in program templates, normalized to the Program shape.
 */
function normalizePreset(
  preset: Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt'> | Program,
  idStr: string
): Program {
  if ('id' in preset && preset.id) {
    return preset as Program;
  }
  const now = new Date().toISOString();
  return {
    ...(preset as Program),
    id: idStr,
    profileId: 'preset',
    createdAt: now,
    updatedAt: now,
  };
}

export const ALL_PRESETS: Program[] = [
  normalizePreset(TYTAX_ELITE_V3, 'preset_tytax_elite_v3'),
  normalizePreset(BW_FUNDAMENTALS, 'preset_bw_fundamentals'),
  KB_SIMPLE_SINISTER,
  KB_HYPERTROPHY,
  KB_CONDITIONING,
];

/** Find a preset by its preset-stable id */
export function getPresetById(id: string): Program | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

/** The stable preset IDs for KB programs (used in UI to detect "already installed"). */
export const KB_PRESET_IDS = [
  KB_SIMPLE_SINISTER.id,
  KB_HYPERTROPHY.id,
  KB_CONDITIONING.id,
] as const;
