import { describe, it, expect } from 'vitest';
import { SETUP_FIELDS } from '@/stores/setup-adapter';
import { SETUP_STRINGS, type SetupKey } from '../setup';

describe('setup string table', () => {
  it('has the same keys in en and hr', () => {
    expect(Object.keys(SETUP_STRINGS.hr).sort()).toEqual(Object.keys(SETUP_STRINGS.en).sort());
  });

  it('has no empty strings and the same placeholders per key', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(SETUP_STRINGS.en) as SetupKey[]) {
      expect(SETUP_STRINGS.en[key].trim()).not.toBe('');
      expect(SETUP_STRINGS.hr[key].trim()).not.toBe('');
      expect(vars(SETUP_STRINGS.hr[key])).toEqual(vars(SETUP_STRINGS.en[key]));
    }
  });

  it('has a label for every machine-setup field', () => {
    for (const field of SETUP_FIELDS) {
      expect(SETUP_STRINGS.en[`setup_${field}` as SetupKey]).toBeTruthy();
    }
  });
});
