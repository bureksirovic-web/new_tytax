import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { registerLocale } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { hr } from '@/lib/i18n/hr';

/**
 * In the app the browser gets the hr core dictionary up front, each hr module
 * through its pack (imported by the files that use it) and English as one lazy
 * chunk (`loadLocale`). Unit tests render single components in English and in
 * hr synchronously (see the locale-core mock below), so both full dictionaries
 * are registered up front, as if every chunk had loaded. The lazy and pack
 * paths are tested with a fresh module registry in
 * src/lib/i18n/__tests__/lazy-locale.test.ts and
 * src/components/providers/__tests__/locale-provider-lazy.test.tsx; that every
 * file imports the packs it uses is checked by src/lib/i18n/__tests__/packs.test.ts.
 */
registerLocale('hr', hr);
registerLocale('en', en);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

/**
 * Integration (v2-g5 merge): the G1-G4 component tests assert English copy and
 * were written (and passed) against a provider whose default was 'en' (G5's
 * locale-core shim said so on purpose). The app default is now G4's 'hr'
 * (D3/AC14, G4-01/G4-40). Unit tests keep rendering English by default; tests
 * that switch to hr still see hr. The real hr default is pinned where it
 * matters by `vi.unmock('@/components/providers/locale-core')` in
 * src/components/providers/__tests__/locale-provider.test.tsx.
 */
vi.mock('@/components/providers/locale-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/providers/locale-core')>();
  const DEFAULT_LOCALE = 'en' as const;
  return {
    ...actual,
    DEFAULT_LOCALE,
    // Same contract as the real one, with this default (the real one closes over 'hr').
    readStoredLocale: (storage: Pick<Storage, 'getItem'> | undefined) => {
      try {
        const saved = storage?.getItem(actual.LOCALE_STORAGE_KEY);
        return actual.isLocale(saved) ? saved : DEFAULT_LOCALE;
      } catch {
        return DEFAULT_LOCALE;
      }
    },
  };
});
