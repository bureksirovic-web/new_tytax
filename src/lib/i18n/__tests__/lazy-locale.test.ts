import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * src/test-setup.ts registers both full dictionaries up front for the other
 * unit tests; here every test imports a fresh `@/lib/i18n` (vi.resetModules),
 * which starts as the browser does: hr core only, English not loaded.
 */
async function freshI18n() {
  vi.resetModules();
  return import('..');
}

afterEach(() => {
  vi.doUnmock('../en');
  vi.restoreAllMocks();
});

describe('lazy locale loading', () => {
  it('starts with only the default locale; t() for an unloaded locale falls back to hr, never blank', async () => {
    const i18n = await freshI18n();
    expect(i18n.DEFAULT_LOCALE).toBe('hr');
    expect(i18n.isLocaleLoaded('hr')).toBe(true);
    expect(i18n.isLocaleLoaded('en')).toBe(false);
    expect(i18n.t('nav_home', 'en')).toBe('Početna');
    expect(i18n.t('workout_set_n', 'en', { n: 3 })).toBe('Serija 3');
    expect(i18n.loadableLocales().sort()).toEqual(['en', 'hr']);
  });

  it('loadLocale fetches English once, notifies subscribers, then t() is English', async () => {
    const i18n = await freshI18n();
    const listener = vi.fn();
    const unsubscribe = i18n.subscribeLocales(listener);
    const first = i18n.loadLocale('en');
    // concurrent callers share the one request
    expect(i18n.loadLocale('en')).toBe(first);
    await first;
    expect(listener).toHaveBeenCalledTimes(1);
    expect(i18n.isLocaleLoaded('en')).toBe(true);
    expect(i18n.t('nav_home', 'en')).toBe('Home');
    expect(i18n.t('workout_set_n', 'en', { n: 3 })).toBe('Set 3');
    // hr is unchanged, and a loaded locale resolves without notifying again
    expect(i18n.t('nav_home', 'hr')).toBe('Početna');
    await i18n.loadLocale('en');
    await i18n.loadLocale('hr');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('a failed load rejects, keeps hr, and can be retried', async () => {
    vi.doMock('../en', () => {
      throw new Error('offline');
    });
    const i18n = await freshI18n();
    await expect(i18n.loadLocale('en')).rejects.toThrow();
    expect(i18n.isLocaleLoaded('en')).toBe(false);
    expect(i18n.t('nav_home', 'en')).toBe('Početna');

    vi.doUnmock('../en');
    vi.resetModules();
    // the rejected request is not cached: a retry loads the chunk
    await i18n.loadLocale('en');
    expect(i18n.t('nav_home', 'en')).toBe('Home');
  });

  it('first-load i18n code imports neither full dictionary statically', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
    const index = readFileSync(join(dir, 'index.ts'), 'utf8');
    expect(index).not.toMatch(/^import [^;]* from '\.\/(en|hr|dictionaries)';$/m);
    expect(index).toMatch(/import\('\.\/en'\)/);
    // hr core only; the packs add the rest
    expect(index).toMatch(/^import \{ coreHr \} from '\.\/modules\/core\.hr';$/m);
  });
});
