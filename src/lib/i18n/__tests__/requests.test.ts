/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { t, type TranslationKey } from '..';
import { en } from '../en';
import { hr } from '../hr';

type Table = { en: Record<string, string>; hr: Record<string, string> };

/** Every `{ en, hr }` string table a module exports (G3's `*_STRINGS`, G5's `AUTH_STRINGS`). */
function tablesOf(mod: Record<string, unknown>): [string, Table][] {
  return Object.entries(mod).filter(
    (e): e is [string, Table] =>
      typeof e[1] === 'object' && e[1] !== null && 'en' in e[1] && 'hr' in e[1]
  );
}

/** Keys whose en or hr value in `table` differs from (or is missing in) the shared dictionary. */
function drift(table: Table): string[] {
  const dict = { en: en as Record<string, string>, hr: hr as Record<string, string> };
  return Object.keys(table.en).filter(
    (k) => dict.en[k] !== table.en[k] || dict.hr[k] !== table.hr[k]
  );
}

// Other goals' local tables. The globs match nothing on v2-g4 (the files arrive at integration),
// so the drift tests below run only in a merged tree.
const foreign = {
  ...import.meta.glob('/src/components/workout/strings/*.ts'),
  ...import.meta.glob('/src/components/tools/tools-strings.ts'),
  ...import.meta.glob('/src/lib/auth/i18n.ts'),
};

describe('keys folded in from other goals (Wave 2)', () => {
  it('G3 keys resolve in both locales, with the review-round values', () => {
    expect(t('rest_timer_stop_label', 'en')).toBe('Skip rest (Space)');
    expect(t('rest_timer_stop_label', 'hr')).toBe('Preskoči odmor (razmaknica)');
    expect(t('pr_intro', 'en', { n: 2 })).toBe('New records this session: 2');
    expect(t('weak_body', 'hr', { muscle: 'Listovi', exercise: 'Podizanje na prste', sets: 3 })).toBe(
      'Mišić koji zaostaje: Listovi. Dodati Podizanje na prste (3 serije)?'
    );
    expect(t('muscle_BACK_VERTICAL', 'en')).toBe('Back (vertical pull)');
    expect(t('foreign_switch', 'hr', { name: 'Ana' })).toBe('Prebaci na Ana');
    expect(t('empty_title', 'en')).toBe('No sets done');
  });

  it('G1 station and attachment labels resolve', () => {
    expect(t('station_SMITH', 'hr')).toBe('Smith stroj');
    expect(t('attachment_DIP_BELT', 'en')).toBe('Dip belt');
  });

  it("G5's dotted auth/sync keys resolve instead of echoing the key", () => {
    expect(t('auth.error.otp_expired' as TranslationKey, 'en')).toBe(
      'This sign-in link has expired. Please request a new one.'
    );
    expect(t('sync.now' as TranslationKey, 'hr')).toBe('Sinkroniziraj sada');
  });

  it('local tables in a merged tree match the dictionary', async () => {
    const paths = Object.keys(foreign).filter((p) => !p.endsWith('/make-strings.ts'));
    const mismatched: string[] = [];
    let checked = 0;
    for (const p of paths) {
      for (const [name, table] of tablesOf((await foreign[p]()) as Record<string, unknown>)) {
        checked += Object.keys(table.en).length;
        mismatched.push(...drift(table).map((k) => `${name}.${k}`));
      }
    }
    expect(mismatched).toEqual([]);
    // A table file that exports no { en, hr } table would make this test vacuous.
    expect(checked > 0).toBe(paths.length > 0);
  });
});
