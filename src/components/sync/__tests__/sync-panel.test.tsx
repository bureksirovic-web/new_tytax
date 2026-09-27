import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncAdapter, SyncState } from '@/contracts/sync';
import { DEFAULT_LOCALE } from '@/components/providers/locale-core';
import { AUTH_STRINGS } from '@/lib/auth/i18n';
// use-sync imports the leaf modules (not the barrel), so the spies target those.
import * as syncAccount from '@/lib/sync/account';
import * as syncInstall from '@/lib/sync/install';
import type { AccountState, AccountStore } from '@/lib/sync';
import { SyncStatus } from '../sync-status';
import { SyncPanel } from '../sync-panel';
import { formatSyncedAt, syncErrorKey } from '../format';

/** Outside a LocaleProvider the UI renders DEFAULT_LOCALE ('en' in this worktree, 'hr' once G4's i18n is merged). */
const ui = AUTH_STRINGS[DEFAULT_LOCALE];

function drive<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    set: (next: T) => {
      value = next;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

function install(state: SyncState, account: AccountState) {
  const s = drive(state);
  const a = drive(account);
  const adapter: SyncAdapter = {
    enabled: state.status !== 'disabled',
    notifyChanged: () => {},
    syncNow: vi.fn(async () => ({ pushed: 0, pulled: 0, failed: 0, state: s.get() })),
    getState: s.get,
    subscribe: (l) => s.subscribe(() => l(s.get())),
  };
  const store: AccountStore = { getState: a.get, subscribe: a.subscribe, signOut: vi.fn(async () => a.set({ status: 'signed_out', email: null })) };
  vi.spyOn(syncInstall, 'getInstalledSyncAdapter').mockReturnValue(adapter);
  vi.spyOn(syncAccount, 'getAccountStore').mockReturnValue(store);
  return { adapter, store, setState: s.set, setAccount: a.set };
}

describe('SyncPanel', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('flag off (real no-op adapter): one disabled line, no buttons, no account, no network', () => {
    render(<SyncPanel />);
    expect(screen.getByTestId('sync-panel')).toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'disabled');
    expect(screen.getByTestId('sync-status')).toHaveTextContent(ui['sync.status.disabled']);
    expect(screen.queryByTestId('sync-now')).toBeNull();
    expect(screen.queryByTestId('sync-account')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('signed in: status, formatted last sync, pending, email; Sync now calls the adapter and disables while syncing', async () => {
    const at = '2026-09-26T10:15:00.000Z';
    const { adapter, setState } = install({ status: 'idle', lastSyncedAt: at, pending: 3 }, { status: 'signed_in', email: 'ana@example.com' });
    render(<SyncPanel />);

    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-status', 'idle');
    expect(screen.getByTestId('sync-status')).toHaveTextContent(ui['sync.status.idle']);
    expect(screen.getByTestId('sync-last-synced')).toHaveTextContent(formatSyncedAt(at, DEFAULT_LOCALE) as string);
    expect(screen.getByTestId('sync-last-synced')).toHaveAttribute('data-value', at);
    expect(screen.getByTestId('sync-pending')).toHaveTextContent('3');
    expect(screen.getByTestId('sync-account-email')).toHaveTextContent('ana@example.com');

    const button = screen.getByTestId('sync-now');
    expect(button).toBeEnabled();
    await act(async () => fireEvent.click(button));
    expect(adapter.syncNow).toHaveBeenCalledTimes(1);

    setState({ status: 'syncing', lastSyncedAt: at, pending: 3 });
    expect(screen.getByTestId('sync-now')).toBeDisabled();
    expect(screen.getByTestId('sync-status')).toHaveTextContent(ui['sync.status.syncing']);
  });

  it('never synced shows "Never"; an error shows its message and code', () => {
    install({ status: 'error', lastSyncedAt: null, pending: 1, lastError: 'network' }, { status: 'signed_in', email: 'a@b.co' });
    render(<SyncPanel />);
    expect(screen.getByTestId('sync-last-synced')).toHaveTextContent(ui['sync.never']);
    expect(screen.getByTestId('sync-error')).toHaveTextContent(ui['sync.error.network']);
    expect(screen.getByTestId('sync-error')).toHaveTextContent('network');
  });

  it('signed out: sign-in link back to the given page, Sync now disabled', () => {
    install({ status: 'error', lastSyncedAt: null, pending: 4, lastError: 'auth_required' }, { status: 'signed_out', email: null });
    render(<SyncPanel nextPath="/auth/account" />);
    expect(screen.getByTestId('sync-sign-in')).toHaveAttribute('href', '/auth/login?next=%2Fauth%2Faccount');
    expect(screen.getByTestId('sync-now')).toBeDisabled();
    expect(screen.getByTestId('sync-error')).toHaveTextContent(ui['sync.error.auth_required']);
    expect(screen.queryByTestId('sync-sign-out')).toBeNull();
  });

  it('SyncStatus (legacy export) is the panel; default sign-in returns to /settings; loading account has no link', () => {
    const { setAccount } = install({ status: 'idle', lastSyncedAt: null, pending: 0 }, { status: 'loading', email: null });
    render(<SyncStatus />);
    expect(screen.getByTestId('sync-account')).toHaveAttribute('data-status', 'loading');
    expect(screen.queryByTestId('sync-sign-in')).toBeNull();
    setAccount({ status: 'signed_out', email: null });
    expect(screen.getByTestId('sync-sign-in')).toHaveAttribute('href', '/auth/login?next=%2Fsettings');
  });

  it('sign out goes through the account store', async () => {
    const { store } = install({ status: 'idle', lastSyncedAt: null, pending: 0 }, { status: 'signed_in', email: 'ana@example.com' });
    render(<SyncPanel />);
    await act(async () => fireEvent.click(screen.getByTestId('sync-sign-out')));
    expect(store.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-account')).toHaveAttribute('data-status', 'signed_out');
    expect(screen.getByTestId('sync-now')).toBeDisabled();
  });
});

describe('format helpers', () => {
  it('formats per locale and rejects missing or bad input', () => {
    expect(formatSyncedAt(null, 'en')).toBeNull();
    expect(formatSyncedAt('not a date', 'en')).toBeNull();
    expect(formatSyncedAt('2026-09-26T10:15:00.000Z', 'hr')).toMatch(/2026/);
  });

  it('maps error codes to keys', () => {
    expect(syncErrorKey('auth_required')).toBe('sync.error.auth_required');
    expect(syncErrorKey('other_account')).toBe('sync.error.other_account');
    expect(syncErrorKey('invalid_row')).toBe('sync.error.invalid_row');
    expect(syncErrorKey('network')).toBe('sync.error.network');
    expect(syncErrorKey('23514')).toBe('sync.error.generic');
  });
});
