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
};

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
  FRESH_MAX: 1.5,
  RECOVERING_MAX: 2.0,
};

export const GAP_THRESHOLD = 0.30; // 30% gap = lagging

export const BRZYCKI_FORMULA = (weight: number, reps: number): number => {
  if (reps >= 37) return weight * (1 + reps / 30); // Epley fallback
  return weight * (36 / (37 - reps));
};
