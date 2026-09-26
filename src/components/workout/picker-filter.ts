/**
 * Pure exercise-picker filtering over an already loaded catalog.
 * Text match is case- and diacritic-insensitive (runtime `foldText`, which
 * also folds đ/ł/ø/ß) on name, pattern, muscle group, tags and search terms;
 * every query word must match. Name-prefix hits sort first, then the
 * catalog order is kept.
 */
import type { EquipmentInventory, Exercise, MuscleGroup } from '@/contracts/domain';
import { ownsStation } from '@/stores/weak-point';
import { foldText } from './runtime/swap-suggestions';

export type PickerModality = 'all' | 'tytax' | 'bodyweight' | 'kettlebell';

export const PICKER_MODALITIES: readonly PickerModality[] = ['all', 'tytax', 'bodyweight', 'kettlebell'];

export interface PickerFilter {
  text: string;
  modality: PickerModality;
  /** '' = every muscle group. */
  muscle: MuscleGroup | '';
}

export const DEFAULT_PICKER_FILTER: PickerFilter = { text: '', modality: 'all', muscle: '' };

/** Rows shown before "show more"; each click adds another page. */
export const PICKER_PAGE_SIZE = 60;

const haystacks = new WeakMap<Exercise, string>();

function haystack(ex: Exercise): string {
  let h = haystacks.get(ex);
  if (h === undefined) {
    h = foldText(
      [ex.name, ex.pattern, ex.muscleGroup.replace(/_/g, ' '), ...(ex.tags ?? []), ...(ex.searchTerms ?? [])].join(' '),
    );
    haystacks.set(ex, h);
  }
  return h;
}

export function filterPickerExercises(all: readonly Exercise[], filter: PickerFilter): Exercise[] {
  const words = foldText(filter.text).split(' ').filter((w) => w.length > 0);
  const hits = all.filter((ex) => {
    if (filter.modality !== 'all' && ex.modality !== filter.modality) return false;
    if (filter.muscle && ex.muscleGroup !== filter.muscle) return false;
    if (words.length === 0) return true;
    const h = haystack(ex);
    return words.every((w) => h.includes(w));
  });
  if (words.length === 0) return hits;
  const first = words[0];
  // Stable sort: name-prefix matches first, otherwise catalog order.
  return hits
    .map((ex, i) => ({ ex, i, prefix: foldText(ex.name).startsWith(first) ? 0 : 1 }))
    .sort((a, b) => a.prefix - b.prefix || a.i - b.i)
    .map((h) => h.ex);
}

/**
 * Inventory rule for swaps: TYTAX exercises need their station unless the
 * inventory records no stations at all (nothing recorded = everything
 * available); every other modality is always available. Stations match as in
 * the weak-point injector (`ownsStation`): `stationId`, else the display
 * `station`, compared case/format-insensitively; no station = available.
 */
export function swapAvailability(inventory: EquipmentInventory | null | undefined): (ex: Exercise) => boolean {
  const stations = inventory?.stationIds ?? [];
  if (stations.length === 0) return () => true;
  return (ex) => ex.modality !== 'tytax' || ownsStation(ex, stations);
}
