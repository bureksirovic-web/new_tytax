import { describe, it, expect } from 'vitest';
import { TIME_STRINGS } from '../time';

describe('time-set string table', () => {
  it('has the same keys in en and hr', () => {
    expect(Object.keys(TIME_STRINGS.hr).sort()).toEqual(Object.keys(TIME_STRINGS.en).sort());
  });

  it('has no empty strings and the same placeholders per key', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(TIME_STRINGS.en) as (keyof typeof TIME_STRINGS.en)[]) {
      expect(TIME_STRINGS.en[key].trim()).not.toBe('');
      expect(TIME_STRINGS.hr[key].trim()).not.toBe('');
      expect(vars(TIME_STRINGS.hr[key])).toEqual(vars(TIME_STRINGS.en[key]));
    }
  });
});
