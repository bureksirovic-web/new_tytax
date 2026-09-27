import { describe, it, expect } from 'vitest';
import {
  t,
  interpolate,
  isLocale,
  readStoredLocale,
  DEFAULT_LOCALE,
  LOCALES,
  type TranslationKey,
} from '..';
import { translations } from '../dictionaries';
import { en } from '../en';
import { hr } from '../hr';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('hr/en key parity', () => {
  const enKeys = Object.keys(en).sort();
  const hrKeys = Object.keys(hr).sort();

  it('every en key exists in hr', () => {
    expect(enKeys.filter((k) => !(k in hr))).toEqual([]);
  });

  it('every hr key exists in en', () => {
    expect(hrKeys.filter((k) => !(k in en))).toEqual([]);
  });

  it('no value is empty in either locale', () => {
    const empty = (d: Record<string, string>) =>
      Object.entries(d).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
    expect(empty(en)).toEqual([]);
    expect(empty(hr)).toEqual([]);
  });

  it('placeholders match between locales', () => {
    const mismatched = enKeys.filter(
      (k) => placeholders(en[k as TranslationKey]).join() !== placeholders(hr[k as TranslationKey]).join()
    );
    expect(mismatched).toEqual([]);
  });

  it('both locales are registered', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['en', 'hr']);
    expect(Object.keys(translations).sort()).toEqual(['en', 'hr']);
  });
});

describe('t()', () => {
  it('defaults to Croatian', () => {
    expect(DEFAULT_LOCALE).toBe('hr');
    expect(t('nav_home')).toBe('Početna');
    expect(t('save')).toBe('Spremi');
  });

  it('returns English when asked', () => {
    expect(t('nav_home', 'en')).toBe('Home');
    expect(t('cancel', 'en')).toBe('Cancel');
  });

  it('returns Croatian when asked', () => {
    expect(t('nav_workout', 'hr')).toBe('Trening');
    expect(t('cancel', 'hr')).toBe('Odustani');
  });

  it('falls back to the key for unknown keys', () => {
    expect(t('nonexistent_key' as TranslationKey, 'en')).toBe('nonexistent_key');
    expect(t('nonexistent_key' as TranslationKey, 'hr')).toBe('nonexistent_key');
  });

  it('interpolates variables', () => {
    expect(t('workout_set_n', 'en', { n: 3 })).toBe('Set 3');
    expect(t('workout_set_n', 'hr', { n: 3 })).toContain('3');
  });
});

describe('interpolate()', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(interpolate('plain')).toBe('plain');
    expect(interpolate('{x}{x}', { x: 'y' })).toBe('yy');
  });
});

describe('locale persistence', () => {
  it('validates locales', () => {
    expect(isLocale('hr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('reads a stored locale or falls back to hr', () => {
    expect(readStoredLocale({ getItem: () => 'en' })).toBe('en');
    expect(readStoredLocale({ getItem: () => 'xx' })).toBe('hr');
    expect(readStoredLocale({ getItem: () => null })).toBe('hr');
    expect(readStoredLocale(undefined)).toBe('hr');
    expect(
      readStoredLocale({
        getItem: () => {
          throw new Error('blocked');
        },
      })
    ).toBe('hr');
  });
});

describe('dictionary modules', () => {
  it('no key is defined in more than one module', async () => {
    const { coreKeys } = await import('../en');
    const mods = await Promise.all(
      ['shared', 'dashboard', 'programs', 'exercises', 'history', 'analytics', 'settings', 'requests', 'g3Tools', 'g3Picker', 'g3Workout', 'g3Session', 'g5Auth', 'patterns', 'patterns2', 'progression'].map(
        async (m) => Object.keys((await import(`../modules/${m}.ts`))[`${m}En`] as Record<string, string>)
      )
    );
    const all = [...coreKeys, ...mods.flat()];
    const dupes = all.filter((k, i) => all.indexOf(k) !== i);
    expect(dupes).toEqual([]);
    expect(all.length).toBe(Object.keys(en).length);
  });
});
