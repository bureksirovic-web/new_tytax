import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { translations, type Locale } from '@/lib/i18n';
import { DEFAULT_LOCALE, interpolate, LOCALE_STORAGE_KEY, readStoredLocale, translate } from '../locale-core';
import { LocaleProvider, useLocale } from '../locale-provider';

/** Shows a plain key, an interpolated key and a language switch. */
function Probe() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="home">{t('nav_home')}</span>
      <span data-testid="set">{t('workout_set_n', { n: 3 })}</span>
      <button type="button" onClick={() => setLocale(locale === 'hr' ? 'en' : 'hr')}>
        switch
      </button>
    </div>
  );
}

const tree = () => (
  <LocaleProvider>
    <Probe />
  </LocaleProvider>
);

const homeIn = (l: Locale) => translations[l].nav_home;
const setIn = (l: Locale, n: number) => translations[l].workout_set_n.replace('{n}', String(n));

let root: Root | null = null;

beforeEach(() => localStorage.clear());

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LocaleProvider', () => {
  it('fresh device: first paint is DEFAULT_LOCALE and <html lang> follows it', () => {
    render(tree());
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE);
    expect(screen.getByTestId('home').textContent).toBe(homeIn(DEFAULT_LOCALE));
    expect(document.documentElement.lang).toBe(DEFAULT_LOCALE);
  });

  // 'hr' is the brief's case; 'en' covers the switch once G4 makes 'hr' the default.
  it.each(['hr', 'en'] as const)('SSR, then hydrating with stored %s: no mismatch, then that language', async (stored) => {
    const win = globalThis.window;
    vi.stubGlobal('window', undefined);
    const html = renderToString(tree());
    vi.stubGlobal('window', win);
    expect(html).toContain(homeIn(DEFAULT_LOCALE));

    localStorage.setItem(LOCALE_STORAGE_KEY, stored);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(host, tree(), { onRecoverableError: (e) => errors.push(e) });
    });

    expect(errors.map(String)).toEqual([]);
    expect(host.querySelector('[data-testid="locale"]')?.textContent).toBe(stored);
    expect(host.querySelector('[data-testid="home"]')?.textContent).toBe(homeIn(stored));
    expect(document.documentElement.lang).toBe(stored);
  });

  it('t(key, vars) interpolates in the current locale', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'hr');
    render(tree());
    expect(screen.getByTestId('set').textContent).toBe(setIn('hr', 3));
    expect(screen.getByTestId('set').textContent).toBe('Serija 3');
  });

  it('setLocale switches, persists, and survives blocked storage', () => {
    render(tree());
    const next: Locale = DEFAULT_LOCALE === 'hr' ? 'en' : 'hr';
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('home').textContent).toBe(homeIn(next));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(next);

    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE);
  });

  it('renders DEFAULT_LOCALE when the window.localStorage getter throws SecurityError', () => {
    const win = globalThis.window;
    let reads = 0;
    // The getter itself throws (blocked site data), not getItem.
    const blocked = new Proxy(win, {
      get(target, prop) {
        if (prop === 'localStorage') {
          reads += 1;
          throw new DOMException('The operation is insecure.', 'SecurityError');
        }
        const value: unknown = Reflect.get(target, prop);
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    vi.stubGlobal('window', blocked);

    render(tree());

    expect(reads).toBeGreaterThan(0);
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE);
    expect(screen.getByTestId('home').textContent).toBe(homeIn(DEFAULT_LOCALE));
    // Switching still works in memory; the setItem path swallows the same SecurityError.
    const next: Locale = DEFAULT_LOCALE === 'hr' ? 'en' : 'hr';
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('locale').textContent).toBe(next);
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de');
    render(tree());
    expect(screen.getByTestId('locale').textContent).toBe(DEFAULT_LOCALE);
  });
});

describe('integration: one locale source (G4-01/G4-40)', () => {
  it('DEFAULT_LOCALE is hr (D3/AC14) and locale-core is G4 src/lib/i18n itself', async () => {
    const i18n = await import('@/lib/i18n');
    expect(DEFAULT_LOCALE).toBe('hr');
    expect(DEFAULT_LOCALE).toBe(i18n.DEFAULT_LOCALE);
    expect(translate).toBe(i18n.t);
    expect(readStoredLocale).toBe(i18n.readStoredLocale);
  });

  it('outside a provider t() shows the default-locale text, never the raw key', () => {
    render(<Probe />);
    expect(screen.getByTestId('home').textContent).toBe(homeIn('hr'));
    expect(screen.getByTestId('set').textContent).toBe(setIn('hr', 3));
  });
});

describe('locale-core (re-export of G4 src/lib/i18n)', () => {
  it('interpolate replaces known {vars} and keeps unknown ones visible', () => {
    expect(interpolate('Set {n} of {total}', { n: 2 })).toBe('Set 2 of {total}');
    expect(interpolate('plain')).toBe('plain');
  });

  it('translate uses the locale, then interpolates', () => {
    expect(translate('workout_set_n', 'en', { n: 4 })).toBe('Set 4');
    expect(translate('nav_home')).toBe(homeIn(DEFAULT_LOCALE));
  });

  it('readStoredLocale: valid, unknown, missing and throwing storage', () => {
    expect(readStoredLocale({ getItem: () => 'hr' })).toBe('hr');
    expect(readStoredLocale({ getItem: () => 'xx' })).toBe(DEFAULT_LOCALE);
    expect(readStoredLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(
      readStoredLocale({
        getItem: () => {
          throw new Error('SecurityError');
        },
      })
    ).toBe(DEFAULT_LOCALE);
  });
});
