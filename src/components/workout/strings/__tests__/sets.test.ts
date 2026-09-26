import { describe, it, expect } from 'vitest';
import { SETS_STRINGS } from '../sets';

describe('sets string table', () => {
  it('has the same keys in en and hr', () => {
    expect(Object.keys(SETS_STRINGS.hr).sort()).toEqual(Object.keys(SETS_STRINGS.en).sort());
  });

  it('has no empty strings and the same placeholders per key', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(SETS_STRINGS.en) as (keyof typeof SETS_STRINGS.en)[]) {
      expect(SETS_STRINGS.en[key].trim()).not.toBe('');
      expect(SETS_STRINGS.hr[key].trim()).not.toBe('');
      expect(vars(SETS_STRINGS.hr[key])).toEqual(vars(SETS_STRINGS.en[key]));
    }
  });
});
