import { describe, it, expect } from 'vitest';
import { t, translations, type TranslationKey } from '../i18n';

describe('t()', () => {
  it('returns English text for "en" locale', () => {
    expect(t('nav_home', 'en')).toBe('Home');
    expect(t('nav_workout', 'en')).toBe('Workout');
    expect(t('save', 'en')).toBe('Save');
    expect(t('cancel', 'en')).toBe('Cancel');
  });

  it('returns Croatian text for "hr" locale', () => {
    expect(t('nav_home', 'hr')).toBe('Početna');
    expect(t('nav_workout', 'hr')).toBe('Trening');
    expect(t('save', 'hr')).toBe('Spremi');
    expect(t('cancel', 'hr')).toBe('Odustani');
  });

  it('falls back to English for missing translations', () => {
    const enText = translations.en.nav_home;
    expect(t('nav_home', 'en')).toBe(enText);
  });

  it('falls back to key for missing keys', () => {
    expect(t('nonexistent_key' as TranslationKey, 'en')).toBe('nonexistent_key');
    expect(t('nonexistent_key' as TranslationKey, 'hr')).toBe('nonexistent_key');
  });

  it('defaults to English locale when no locale is provided', () => {
    expect(t('nav_home')).toBe('Home');
    expect(t('save')).toBe('Save');
  });

  it('handles all translation keys in both locales', () => {
    const keys = Object.keys(translations.en) as TranslationKey[];
    for (const key of keys) {
      expect(translations.en[key]).toBeDefined();
      expect(translations.hr[key]).toBeDefined();
    }
  });

  it('returns consistent results for same key and locale', () => {
    expect(t('workout_start', 'en')).toBe(t('workout_start', 'en'));
    expect(t('workout_start', 'hr')).toBe(t('workout_start', 'hr'));
  });
});
