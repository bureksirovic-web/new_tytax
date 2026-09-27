export const MUSCLE_GROUPS = [
  'Chest',
  'Front Delts',
  'Side Delts',
  'Rear Delts',
  'Upper Traps',
  'Mid/Lower Traps',
  'Lats',
  'Rhomboids',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Hip Flexors',
  'Adductors',
  'Abductors',
  'Spinal Erectors',
  'Serratus',
  'Rotator Cuff',
  'Neck',
] as const;

export type StandardMuscle = (typeof MUSCLE_GROUPS)[number];

// Maps raw muscle names from old data to standardized names
export const MUSCLE_NAME_MAP: Record<string, StandardMuscle> = {
  // Chest
  'Chest': 'Chest',
  'CHEST': 'Chest',
  'Chest (sternal pec)': 'Chest',
  'Upper Chest (clavicular pec)': 'Chest',
  'Pectoralis': 'Chest',
  // Delts
  'Front Delts': 'Front Delts',
  'ANTERIOR DELT': 'Front Delts',
  'Anterior Delt': 'Front Delts',
  'Side Delts': 'Side Delts',
  'Lateral Delt': 'Side Delts',
  'LATERAL DELT': 'Side Delts',
  'Rear Delts': 'Rear Delts',
  'Rear Delt': 'Rear Delts',
  'POSTERIOR DELT': 'Rear Delts',
  'Shoulders': 'Side Delts',
  // Traps
  'Upper Traps': 'Upper Traps',
  'Traps': 'Upper Traps',
  'Mid/Lower Traps + Rhomboids': 'Mid/Lower Traps',
  'Mid Traps': 'Mid/Lower Traps',
  // Back
  'Lats': 'Lats',
  'LATISSIMUS': 'Lats',
  'Upper Back': 'Mid/Lower Traps',
  'Rhomboids': 'Rhomboids',
  // Arms
  'Biceps': 'Biceps',
  'BICEPS': 'Biceps',
  'Biceps (stability)': 'Biceps',
  'Triceps': 'Triceps',
  'TRICEPS': 'Triceps',
  'Forearms': 'Forearms',
  'Forearms/Grip': 'Forearms',
  // Legs
  'Quads': 'Quads',
  'QUADRICEPS': 'Quads',
  'Thighs': 'Quads',
  'Hamstrings': 'Hamstrings',
  'HAMSTRINGS': 'Hamstrings',
  'Glutes': 'Glutes',
  'GLUTES': 'Glutes',
  'Hips': 'Glutes',
  'Calves': 'Calves',
  'CALVES': 'Calves',
  // Core
  'Core': 'Core',
  'CORE': 'Core',
  'Core (anti-rotation)': 'Core',
  'Core (bracing)': 'Core',
  'Abs': 'Core',
  'Obliques': 'Core',
  'Waist/Obliques': 'Core',
  'Lower Back': 'Spinal Erectors',
  'Spinal Erectors': 'Spinal Erectors',
  'Spinal Erectors (stability)': 'Spinal Erectors',
  // Other
  'Serratus': 'Serratus',
  'Rotator Cuff': 'Rotator Cuff',
  'Hip Flexors': 'Hip Flexors',
  'Adductors': 'Adductors',
  'Abductors': 'Abductors',
  'Neck': 'Neck',
  // Names used by the current catalog data (tytax JSON, bodyweight, kettlebell)
  'Mid/Lower Traps': 'Mid/Lower Traps',
  'Lower Traps': 'Mid/Lower Traps',
  'Mid Traps + Rhomboids': 'Mid/Lower Traps',
  'Mid Back': 'Rhomboids',
  'Mid Back (rhomboids/mid traps)': 'Rhomboids',
  'Upper/Mid Back (rhomboids/mid traps)': 'Rhomboids',
  'Upper Chest': 'Chest',
  'Upper Chest bias': 'Chest',
  'Lower Chest bias': 'Chest',
  'Lower Chest (costal pec)': 'Chest',
  'Delts (anterior/medial)': 'Front Delts',
  'Rear Deltoids': 'Rear Delts',
  'Upper Traps/Scapular stabilizers': 'Upper Traps',
  'Serratus/Scapular depressors': 'Serratus',
  'Serratus/Scapular control': 'Serratus',
  'Serratus/Scapular stabilizers': 'Serratus',
  'Supraspinatus': 'Rotator Cuff',
  'Shoulder stabilizers': 'Rotator Cuff',
  'Brachialis': 'Biceps',
  'Supinators/Biceps synergy': 'Biceps',
  'Anconeus': 'Triceps',
  'Brachioradialis': 'Forearms',
  'Brachialis/Brachioradialis': 'Forearms',
  'Grip': 'Forearms',
  'Wrist Flexors': 'Forearms',
  'Wrist Extensors': 'Forearms',
  'Forearm Flexors': 'Forearms',
  'Pronators': 'Forearms',
  'Gastrocnemius': 'Calves',
  'Soleus': 'Calves',
  'Foot/Ankle Stabilizers': 'Calves',
  'Glute Med/Min': 'Glutes',
  'Glutes/Hip rotators': 'Glutes',
  'Quadratus Lumborum': 'Core',
};

// Maps (not the object) so prototype keys like "constructor" never resolve.
const MUSCLE_NAME_MAP_EXACT: ReadonlyMap<string, StandardMuscle> = new Map(Object.entries(MUSCLE_NAME_MAP));
const MUSCLE_NAME_MAP_LOWER: ReadonlyMap<string, StandardMuscle> = new Map(
  Object.entries(MUSCLE_NAME_MAP).map(([k, v]) => [k.toLowerCase(), v] as const),
);

/**
 * Standardised muscle name for a raw impact name.
 * Order: exact `MUSCLE_NAME_MAP` hit → case-insensitive hit → the same after
 * stripping parenthetical qualifiers ("Quads (stability)" → "Quads").
 * Unknown names pass through unchanged.
 */
export function standardizeMuscle(raw: string): string {
  const exact = MUSCLE_NAME_MAP_EXACT.get(raw);
  if (exact) return exact;
  const lower = raw.trim().toLowerCase();
  const ci = MUSCLE_NAME_MAP_LOWER.get(lower);
  if (ci) return ci;
  const stripped = lower.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return MUSCLE_NAME_MAP_LOWER.get(stripped) ?? raw;
}

export const TYTAX_STATIONS = {
  SMITH: 'Smith Machine',
  BACK_UPPER: 'Back Upper Pulley',
  BACK_LOWER: 'Back Lower Pulley',
  LEG_EXTENSION: 'Leg Extension',
  LEG_CURL: 'Leg Curl',
  TYTAX: 'Tytax',
} as const;

export const MODALITY_LABELS: Record<string, string> = {
  tytax: 'TYTAX T1',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  custom: 'Custom',
};

export const MODALITY_COLORS: Record<string, string> = {
  tytax: 'text-tactical-amber',
  bodyweight: 'text-od-green',
  kettlebell: 'text-steel-blue',
  custom: 'text-gunmetal-400',
};

export const ACWR_THRESHOLDS = {
  UNDERTRAIN_MAX: 0.8,
  OPTIMAL_MAX: 1.3,
  CAUTION_MAX: 1.5,
} as const;

export const GAP_THRESHOLD = 0.30; // 30% gap = lagging

/**
 * Most reps one set can hold: the workout reps field clamps to it, the store
 * clamps patches to it, the persisted-draft validator and the history editor
 * accept up to it (refuter R2, 2026-09-27: they disagreed at 100 vs 1000).
 */
export const MAX_SET_REPS = 1000;
