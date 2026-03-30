import type { Program } from '@/types/program';
import { TYTAX_ELITE_V3 } from '@/data/tytax/presets';
import { BW_FUNDAMENTALS } from '@/data/bodyweight/presets';
import { KB_SIMPLE_SINISTER, KB_HYPERTROPHY, KB_CONDITIONING } from '@/data/kettlebell/presets';

/**
 * All built-in program templates, normalized to the Omit<Program, 'id'|'profileId'|'createdAt'|'updatedAt'> shape.
 * KB presets ship as full Program objects (with preset ids) — we strip the user-specific fields here so
 * installPreset() can stamp fresh values on installation.
 */
type PresetProgram = Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>;

function stripUserFields(p: Program): PresetProgram {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, profileId: _profileId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = p;
  return rest;
}

export const ALL_PRESETS: PresetProgram[] = [
  TYTAX_ELITE_V3,
  BW_FUNDAMENTALS,
  stripUserFields(KB_SIMPLE_SINISTER),
  stripUserFields(KB_HYPERTROPHY),
  stripUserFields(KB_CONDITIONING),
];

/** Find a preset by its preset-stable id (KB presets carry an id in their full Program form). */
export function getPresetById(id: string): PresetProgram | undefined {
  // KB presets retain their id in the original full Program object.
  const KB_IDS: Record<string, Program> = {
    [KB_SIMPLE_SINISTER.id]: KB_SIMPLE_SINISTER,
    [KB_HYPERTROPHY.id]: KB_HYPERTROPHY,
    [KB_CONDITIONING.id]: KB_CONDITIONING,
  };
  if (id in KB_IDS) return stripUserFields(KB_IDS[id]);

  // For TYTAX / BW presets, match by name (they have no stable id before installation)
  return ALL_PRESETS.find((p) => (p as Program & { id?: string }).id === id);
}

/** The stable preset IDs for KB programs (used in UI to detect "already installed"). */
export const KB_PRESET_IDS = [
  KB_SIMPLE_SINISTER.id,
  KB_HYPERTROPHY.id,
  KB_CONDITIONING.id,
] as const;
