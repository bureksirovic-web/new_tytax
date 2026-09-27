import { describe, expect, it } from 'vitest';
import { browserStorage, createCursorStore, cursorKey, pullSince, safeStorage, type SyncStorage } from '../cursors';
import { ACCOUNT_A, MemoryStorage } from './harness';

const throwing: SyncStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('cursor store', () => {
  it('persists per (account, table) under the documented key', () => {
    const storage = new MemoryStorage();
    const cursors = createCursorStore(storage);
    expect(cursors.get(ACCOUNT_A, 'programs')).toEqual({ lastPulledAt: null, lastPulledId: null, lastPushedAt: null });
    cursors.set(ACCOUNT_A, 'programs', { lastPulledAt: '2026-01-01T00:00:00.5+00:00', lastPulledId: 'x' });
    cursors.set(ACCOUNT_A, 'programs', { lastPushedAt: '2026-01-02T00:00:00.000Z' });
    expect(cursorKey(ACCOUNT_A, 'programs')).toBe(`tytax.sync.cursor.v1.${ACCOUNT_A}.programs`);
    expect(JSON.parse(storage.getItem(cursorKey(ACCOUNT_A, 'programs')) ?? '')).toEqual({
      lastPulledAt: '2026-01-01T00:00:00.5+00:00',
      lastPulledId: 'x',
      lastPushedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(cursors.get(ACCOUNT_A, 'arsenal').lastPulledAt).toBeNull();
  });

  it('treats malformed stored values as an empty cursor', () => {
    const storage = new MemoryStorage();
    storage.setItem(cursorKey(ACCOUNT_A, 'arsenal'), '{not json');
    storage.setItem(cursorKey(ACCOUNT_A, 'equipment'), '42');
    storage.setItem(cursorKey(ACCOUNT_A, 'programs'), JSON.stringify({ lastPulledAt: 7, lastPulledId: '' }));
    const cursors = createCursorStore(storage);
    expect(cursors.get(ACCOUNT_A, 'arsenal').lastPulledAt).toBeNull();
    expect(cursors.get(ACCOUNT_A, 'equipment').lastPulledAt).toBeNull();
    expect(cursors.get(ACCOUNT_A, 'programs')).toEqual({ lastPulledAt: null, lastPulledId: null, lastPushedAt: null });
  });

  it('keeps working in memory when localStorage throws', () => {
    const cursors = createCursorStore(safeStorage(() => throwing));
    cursors.set(ACCOUNT_A, 'profiles', { lastPulledAt: '2026-01-01T00:00:00.000Z' });
    expect(cursors.get(ACCOUNT_A, 'profiles').lastPulledAt).toBe('2026-01-01T00:00:00.000Z');
    const broken = safeStorage(() => {
      throw new Error('no window');
    });
    expect(broken.getItem('k')).toBeNull();
    broken.setItem('k', 'v');
    expect(broken.getItem('k')).toBe('v');
    broken.removeItem('k');
    expect(broken.getItem('k')).toBeNull();
    const throwingRemove = safeStorage(() => throwing);
    expect(() => throwingRemove.removeItem('k')).not.toThrow();
  });

  it('browserStorage reads and writes window.localStorage', () => {
    const s = browserStorage();
    s.setItem('tytax.sync.test', 'v');
    expect(window.localStorage.getItem('tytax.sync.test')).toBe('v');
    s.removeItem('tytax.sync.test');
    expect(browserStorage().getItem('tytax.sync.test')).toBeNull();
  });
});

describe('pullSince', () => {
  it('subtracts the 5 s overlap, or pulls everything without a cursor', () => {
    expect(pullSince({ lastPulledAt: null, lastPulledId: null, lastPushedAt: null })).toBeNull();
    expect(pullSince({ lastPulledAt: '2026-01-01T00:00:10.123456+00:00', lastPulledId: 'x', lastPushedAt: null })).toBe('2026-01-01T00:00:05.123Z');
    expect(pullSince({ lastPulledAt: 'garbage', lastPulledId: null, lastPushedAt: null })).toBeNull();
  });
});
