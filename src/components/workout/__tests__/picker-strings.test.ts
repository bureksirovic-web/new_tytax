import { describe, it, expect } from 'vitest';
import { MUSCLE_GROUP_VALUES, PICKER_STRINGS, muscleKey } from '../strings/picker';

describe('PICKER_STRINGS', () => {
  it('hr and en have identical key sets and no empty values', () => {
    const en = Object.keys(PICKER_STRINGS.en).sort();
    expect(Object.keys(PICKER_STRINGS.hr).sort()).toEqual(en);
    for (const table of [PICKER_STRINGS.en, PICKER_STRINGS.hr]) {
      for (const v of Object.values(table)) expect(v.trim()).not.toBe('');
    }
  });

  it('every MuscleGroup has a label in both languages', () => {
    expect(MUSCLE_GROUP_VALUES).toHaveLength(12);
    for (const g of MUSCLE_GROUP_VALUES) {
      expect(PICKER_STRINGS.en[muscleKey(g)]).toBeTruthy();
      expect(PICKER_STRINGS.hr[muscleKey(g)]).toBeTruthy();
    }
  });
});
