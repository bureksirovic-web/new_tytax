import type { MuscleGroup } from '@/contracts/domain';
import { makeStringsHook, type StringTable } from './make-strings';
import '@/lib/i18n/packs/g3Picker';

/**
 * Exercise picker + swap sheet strings (G3 area "picker").
 * Keys are mirrored in docs/v2/requests/G3-i18n.md.
 */
const en = {
  picker_filter_modality: 'Equipment',
  picker_filter_muscle: 'Muscle group',
  picker_showing: 'Showing {shown} of {total}',
  muscle_CHEST: 'Chest',
  muscle_BACK_VERTICAL: 'Back (vertical pull)',
  muscle_BACK_HORIZONTAL: 'Back (horizontal pull)',
  muscle_SHOULDERS: 'Shoulders',
  muscle_BICEPS: 'Biceps',
  muscle_TRICEPS: 'Triceps',
  muscle_FOREARMS_GRIP: 'Forearms & grip',
  muscle_QUADS: 'Quads',
  muscle_HAMSTRINGS: 'Hamstrings',
  muscle_GLUTES: 'Glutes',
  muscle_CALVES: 'Calves',
  muscle_CORE: 'Core',
  swap_title: 'Swap {name}',
  swap_search: 'Search by name',
  swap_similar: 'Similar exercises',
  swap_results: 'Name matches',
  swap_none: 'No available alternatives',
  swap_type_more: 'Type 3 or more letters to search by name',
} as const;

export type PickerKey = keyof typeof en;

const hr: Record<PickerKey, string> = {
  picker_filter_modality: 'Oprema',
  picker_filter_muscle: 'Mišićna skupina',
  picker_showing: 'Prikazano {shown} od {total}',
  muscle_CHEST: 'Prsa',
  muscle_BACK_VERTICAL: 'Leđa (vertikalno povlačenje)',
  muscle_BACK_HORIZONTAL: 'Leđa (horizontalno povlačenje)',
  muscle_SHOULDERS: 'Ramena',
  muscle_BICEPS: 'Biceps',
  muscle_TRICEPS: 'Triceps',
  muscle_FOREARMS_GRIP: 'Podlaktice i stisak',
  muscle_QUADS: 'Kvadricepsi',
  muscle_HAMSTRINGS: 'Stražnja loža',
  muscle_GLUTES: 'Gluteusi',
  muscle_CALVES: 'Listovi',
  muscle_CORE: 'Trup',
  swap_title: 'Zamijeni {name}',
  swap_search: 'Pretraži po nazivu',
  swap_similar: 'Slične vježbe',
  swap_results: 'Pogoci po nazivu',
  swap_none: 'Nema dostupnih zamjena',
  swap_type_more: 'Upišite 3 ili više slova za pretragu po nazivu',
};

export const PICKER_STRINGS: StringTable<PickerKey> = { en, hr };

export const usePickerStrings = makeStringsHook<PickerKey>();

/** MuscleGroup values in display order (matches the contract union). */
export const MUSCLE_GROUP_VALUES: readonly MuscleGroup[] = [
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

export function muscleKey(group: MuscleGroup): PickerKey {
  return `muscle_${group}`;
}
