import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from '@/contracts/repo';
import { AUTH_STRINGS } from '@/lib/auth/i18n';
import { DEFAULT_LOCALE } from '../locale-core';
import type { E2EBootHooks } from '../e2e-hooks';

/** ensureActive calls wait on these deferreds, answered one by one by the test. */
const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
const ensureActive = vi.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      pending.push({ resolve, reject });
    })
);

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/db')>();
  return {
    ...actual,
    getRepository: (): Repository => {
      const real = actual.getRepository();
      // The gate decides the outcome; on success the real repository does the work.
      const gated = (name: string) => ensureActive().then(() => real.profiles.ensureActive(name));
      return { ...real, profiles: { ...real.profiles, ensureActive: gated } };
    },
  };
});

/** A fresh module per test: its once-per-load boot guard must not leak between tests. */
async function loadAppBootstrap() {
  vi.resetModules();
  return (await import('../app-bootstrap')).AppBootstrap;
}

const ui = AUTH_STRINGS[DEFAULT_LOCALE];
const hooks = () => window.__tytaxE2E as unknown as E2EBootHooks | undefined;

beforeEach(() => {
  pending.length = 0;
  ensureActive.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe('AppBootstrap when ensureActive fails', () => {
  it('installs the hooks first, exposes bootError, shows the error and retries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const AppBootstrap = await loadAppBootstrap();
    render(<AppBootstrap />);

    // Hooks are on window while ensureActive is still pending: not ready, no error.
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(hooks()?.ready).toBe(false);
    expect(hooks()?.bootError).toBeUndefined();
    expect(typeof hooks()?.reset).toBe('function');
    expect(screen.queryByTestId('app-boot-error')).toBeNull();

    await act(async () => pending[0].reject(new Error('UpgradeError: Dexie migration 4 failed')));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'app-boot-error');
    expect(alert).toHaveTextContent(ui['app.boot.error_title']);
    expect(alert).toHaveTextContent(ui['app.boot.error_body']);
    expect(screen.getByTestId('app-boot-error-detail')).toHaveTextContent('UpgradeError: Dexie migration 4 failed');
    expect(hooks()?.ready).toBe(false);
    expect(hooks()?.bootError).toBe('UpgradeError: Dexie migration 4 failed');
    expect(consoleError).toHaveBeenCalledWith('[tytax] app bootstrap failed', expect.any(Error));

    // Retry: a second boot runs, re-installs fresh hooks and succeeds.
    fireEvent.click(screen.getByRole('button', { name: ui['app.boot.retry'] }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(screen.queryByTestId('app-boot-error')).toBeNull();
    expect(hooks()?.bootError).toBeUndefined();
    expect(hooks()?.ready).toBe(false);

    await act(async () => pending[1].resolve());
    await waitFor(() => expect(hooks()?.ready).toBe(true));
    expect(hooks()?.bootError).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
    // 2: the failed boot and the retry; nothing else called ensureActive.
    expect(ensureActive).toHaveBeenCalledTimes(2);
  });

  it('a non-Error rejection is shown as its string', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const AppBootstrap = await loadAppBootstrap();
    render(<AppBootstrap />);
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0].reject('quota exceeded'));
    expect(await screen.findByTestId('app-boot-error-detail')).toHaveTextContent('quota exceeded');
    expect(hooks()?.bootError).toBe('quota exceeded');
  });
});
