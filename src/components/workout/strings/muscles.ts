'use client';
import { MUSCLE_GROUPS, type StandardMuscle } from '@/lib/constants';
import { makeStringsHook, type StringTable } from './make-strings';

/** Standardised muscle names (`standardizeMuscle` output), e.g. in the weak-point offer. */
export type MuscleKey = `muscle_name_${string}`;

/** 'Mid/Lower Traps' → 'muscle_name_mid_lower_traps'. */
export function muscleNameKey(muscle: string): MuscleKey {
  return `muscle_name_${muscle.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')}`;
}

/** Croatian names; English uses the standard name itself. */
const HR_NAMES: Record<StandardMuscle, string> = {
  Chest: 'Prsa',
  'Front Delts': 'Prednja ramena',
  'Side Delts': 'Bočna ramena',
  'Rear Delts': 'Stražnja ramena',
  'Upper Traps': 'Gornji trapez',
  'Mid/Lower Traps': 'Srednji/donji trapez',
  Lats: 'Latissimus',
  Rhomboids: 'Romboidi',
  Biceps: 'Biceps',
  Triceps: 'Triceps',
  Forearms: 'Podlaktice',
  Quads: 'Kvadriceps',
  Hamstrings: 'Stražnja loža',
  Glutes: 'Gluteusi',
  Calves: 'Listovi',
  Core: 'Trup',
  'Hip Flexors': 'Pregibači kuka',
  Adductors: 'Aduktori',
  Abductors: 'Abduktori',
  'Spinal Erectors': 'Uspravljači kralježnice',
  Serratus: 'Prednji nazubljeni mišić',
  'Rotator Cuff': 'Rotatorna manžeta',
  Neck: 'Vrat',
};

const table = (name: (m: StandardMuscle) => string): Record<MuscleKey, string> =>
  Object.fromEntries(MUSCLE_GROUPS.map((m) => [muscleNameKey(m), name(m)])) as Record<MuscleKey, string>;

export const MUSCLE_STRINGS: StringTable<MuscleKey> = { en: table((m) => m), hr: table((m) => HR_NAMES[m]) };

const useMuscleStrings = makeStringsHook(MUSCLE_STRINGS);

/** Localised muscle name; an unknown (non-standard) name is shown as is. */
export function useMuscleName(): (muscle: string) => string {
  const t = useMuscleStrings();
  return (muscle) => {
    const key = muscleNameKey(muscle);
    return key in MUSCLE_STRINGS.en ? t(key) : muscle;
  };
}
