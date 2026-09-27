import { describe, it, expect } from 'vitest';
import type { EquipmentInventory } from '@/contracts/domain';
import { DEFAULT_PICKER_FILTER, filterPickerExercises, swapAvailability } from '../picker-filter';
import { ex } from './picker-helpers';

const ALL = [
  ex('bench', 'Bench Press'),
  ex('squat', 'Čučanj sa šipkom', { muscleGroup: 'QUADS', pattern: 'squat' }),
  ex('pushup', 'Push-up', { modality: 'bodyweight' }),
  ex('swing', 'Kettlebell Swing', { modality: 'kettlebell', muscleGroup: 'GLUTES', pattern: 'hinge', tags: ['ballistic'] }),
  ex('incline', 'Incline Bench Press'),
  ex('dead', 'Mrtvo dizanje đ', { muscleGroup: 'HAMSTRINGS', pattern: 'hinge', searchTerms: ['deadlift'] }),
];

const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe('filterPickerExercises', () => {
  it('no filter keeps catalog order', () => {
    expect(ids(filterPickerExercises(ALL, DEFAULT_PICKER_FILTER))).toEqual(ids(ALL));
  });

  it('text is case- and diacritic-insensitive (č, š, đ)', () => {
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'CUCANJ SA SIPKOM' }))).toEqual(['squat']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'dizanje d' }))).toEqual(['dead']);
  });

  it('matches pattern, tags and search terms; every word must match', () => {
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'hinge' }))).toEqual(['swing', 'dead']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'ballistic' }))).toEqual(['swing']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'deadlift' }))).toEqual(['dead']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'bench zzz' }))).toEqual([]);
  });

  it('name-prefix matches sort first, then catalog order', () => {
    // "press" is a word in both names but neither starts with it -> catalog order.
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'press' }))).toEqual(['bench', 'incline']);
    // "incl" prefixes Incline only; "bench" prefixes Bench, Incline matches later in the name.
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, text: 'bench' }))).toEqual(['bench', 'incline']);
    const reordered = [ALL[4], ALL[0]];
    expect(ids(filterPickerExercises(reordered, { ...DEFAULT_PICKER_FILTER, text: 'bench' }))).toEqual(['bench', 'incline']);
  });

  it('modality and muscle filters combine with text', () => {
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, modality: 'bodyweight' }))).toEqual(['pushup']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, modality: 'kettlebell' }))).toEqual(['swing']);
    expect(ids(filterPickerExercises(ALL, { ...DEFAULT_PICKER_FILTER, muscle: 'CHEST' }))).toEqual(['bench', 'pushup', 'incline']);
    expect(ids(filterPickerExercises(ALL, { text: 'incl', modality: 'tytax', muscle: 'CHEST' }))).toEqual(['incline']);
    expect(ids(filterPickerExercises(ALL, { text: '', modality: 'bodyweight', muscle: 'QUADS' }))).toEqual([]);
  });
});

function inventory(stationIds: string[]): EquipmentInventory {
  return {
    id: 'p1',
    profileId: 'p1',
    stationIds,
    attachmentIds: [],
    kettlebellsKg: [],
    bodyweightGear: [],
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
  };
}

describe('swapAvailability', () => {
  const owned = ex('a', 'A', { stationId: 'st1' });
  const missing = ex('b', 'B', { stationId: 'st2' });
  const noStation = ex('c', 'C');
  const bw = ex('d', 'D', { modality: 'bodyweight' });

  it('no inventory or no stations recorded -> everything available', () => {
    for (const inv of [null, undefined, inventory([])]) {
      const ok = swapAvailability(inv);
      expect([owned, missing, noStation, bw].every(ok)).toBe(true);
    }
  });

  it('tytax needs an owned station; other modalities always pass', () => {
    const ok = swapAvailability(inventory(['st1']));
    expect(ok(owned)).toBe(true);
    expect(ok(missing)).toBe(false);
    // Hardening F2: no station = unknown station → available.
    expect(ok(noStation)).toBe(true);
    expect(ok(bw)).toBe(true);
  });
});
