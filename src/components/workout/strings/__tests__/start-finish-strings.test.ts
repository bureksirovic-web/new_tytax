import { describe, it, expect } from 'vitest';
import { START_STRINGS } from '../start';
import { FINISH_STRINGS } from '../finish';

describe.each([
  ['start', START_STRINGS],
  ['finish', FINISH_STRINGS],
] as const)('%s string table', (_name, table) => {
  it('has the same keys in en and hr', () => {
    expect(Object.keys(table.hr).sort()).toEqual(Object.keys(table.en).sort());
  });

  it('has no empty strings and the same placeholders per key', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    const hr: Record<string, string> = table.hr;
    for (const [key, en] of Object.entries<string>(table.en)) {
      expect(en.trim()).not.toBe('');
      expect(hr[key].trim()).not.toBe('');
      expect(vars(hr[key])).toEqual(vars(en));
    }
  });
});
