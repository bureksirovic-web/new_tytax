import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';

// The real locale-core (DEFAULT_LOCALE 'hr'), as in locale-provider.test.tsx.
vi.unmock('@/components/providers/locale-core');

/**
 * src/test-setup.ts registers the English dictionary up front for the other
 * tests. Here each test imports fresh modules (vi.resetModules), so English
 * starts unloaded, as in the browser, where it is a lazy chunk.
 */
async function freshProvider() {
  vi.resetModules();
  const i18n = await import('@/lib/i18n');
  const { LocaleProvider, useLocale } = await import('../locale-provider');
  function Probe() {
    const { locale, setLocale, t } = useLocale();
    return (
      <div>
        <span data-testid="locale">{locale}</span>
        <span data-testid="home">{t('nav_home')}</span>
        <button type="button" onClick={() => setLocale('en')}>
          en
        </button>
      </div>
    );
  }
  const tree = () => (
    <LocaleProvider>
      <Probe />
    </LocaleProvider>
  );
  return { i18n, tree };
}

let root: Root | null = null;

beforeEach(() => localStorage.clear());

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.doUnmock('@/lib/i18n/en');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LocaleProvider with a lazy English dictionary', () => {
  it('stored en: SSR and hydration render hr with no mismatch, then English once its chunk has loaded', async () => {
    const { i18n, tree } = await freshProvider();
    expect(i18n.isLocaleLoaded('en')).toBe(false);

    const win = globalThis.window;
    vi.stubGlobal('window', undefined);
    const html = renderToString(tree());
    vi.stubGlobal('window', win);
    expect(html).toContain('Početna');

    localStorage.setItem('locale', 'en');
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(host, tree(), { onRecoverableError: (e) => errors.push(e) });
    });

    expect(errors.map(String)).toEqual([]);
    await waitFor(() => expect(host.querySelector('[data-testid="locale"]')?.textContent).toBe('en'));
    expect(host.querySelector('[data-testid="home"]')?.textContent).toBe('Home');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.isLocaleLoaded('en')).toBe(true);
  });

  it('switching to English persists at once, keeps hr (no raw keys) until the chunk arrives, then re-renders', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // Hold the chunk back so the in-between render is observable.
    vi.doMock('@/lib/i18n/en', async () => {
      await gate;
      return vi.importActual('@/lib/i18n/en');
    });
    const { i18n, tree } = await freshProvider();
    render(tree());
    expect(screen.getByTestId('home').textContent).toBe('Početna');

    act(() => screen.getByRole('button').click());
    expect(localStorage.getItem('locale')).toBe('en');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(i18n.isLocaleLoaded('en')).toBe(false);
    expect(screen.getByTestId('locale').textContent).toBe('hr');
    expect(screen.getByTestId('home').textContent).toBe('Početna');

    release();
    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
    expect(screen.getByTestId('home').textContent).toBe('Home');
  });

  it('a chunk that cannot load (offline, not cached) keeps hr and logs the failure', async () => {
    vi.doMock('@/lib/i18n/en', () => {
      throw new Error('offline');
    });
    const { tree } = await freshProvider();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('locale', 'en');
    render(tree());
    await waitFor(() => expect(error).toHaveBeenCalledWith('locale load failed', 'en', expect.anything()));
    expect(screen.getByTestId('locale').textContent).toBe('hr');
    expect(screen.getByTestId('home').textContent).toBe('Početna');
    expect(document.documentElement.lang).toBe('hr');
  });
});
