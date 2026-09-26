import { describe, it, expect } from 'vitest';
import { TOOLS_STRINGS } from '../tools-i18n';

describe('TOOLS_STRINGS', () => {
  it('hr and en have identical key sets', () => {
    const en = Object.keys(TOOLS_STRINGS.en).sort();
    const hr = Object.keys(TOOLS_STRINGS.hr).sort();
    expect(hr).toEqual(en);
    expect(en.length).toBeGreaterThan(10);
  });

  it('no value is empty', () => {
    for (const table of [TOOLS_STRINGS.en, TOOLS_STRINGS.hr]) {
      for (const v of Object.values(table)) expect(v.trim()).not.toBe('');
    }
  });
});
