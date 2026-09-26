import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock, type WakeLockLike, type WakeLockSentinelLike } from '@/components/workout/runtime/use-wake-lock';

function fakeSentinel() {
  const listeners: (() => void)[] = [];
  const s = {
    released: false,
    release: vi.fn(async () => {
      s.released = true;
      listeners.forEach((l) => l());
    }),
    addEventListener: vi.fn((_: 'release', l: () => void) => listeners.push(l)),
    /** Simulates the browser dropping the lock (tab hidden). */
    drop() {
      s.released = true;
      listeners.forEach((l) => l());
    },
  };
  return s;
}

function fakeWakeLock() {
  const sentinels: ReturnType<typeof fakeSentinel>[] = [];
  const wakeLock = {
    request: vi.fn(async (type: 'screen') => {
      expect(type).toBe('screen');
      const s = fakeSentinel();
      sentinels.push(s);
      return s as WakeLockSentinelLike;
    }),
  };
  return { wakeLock: wakeLock as WakeLockLike & typeof wakeLock, sentinels };
}

function fakeDoc(state: string = 'visible') {
  const target = new EventTarget();
  const doc = Object.assign(target, { visibilityState: state });
  return doc as unknown as Document & { visibilityState: string };
}

describe('useWakeLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a screen lock when enabled', async () => {
    const { wakeLock } = fakeWakeLock();
    const doc = fakeDoc();
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc }));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', async () => {
    const { wakeLock } = fakeWakeLock();
    const { result } = renderHook(() => useWakeLock(false, { wakeLock, doc: fakeDoc() }));
    await act(async () => {});
    expect(wakeLock.request).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it('is a no-op when unsupported', async () => {
    const { result } = renderHook(() => useWakeLock(true, { wakeLock: null, doc: fakeDoc() }));
    await act(async () => {});
    expect(result.current.active).toBe(false);
  });

  it('is a no-op when navigator has no wakeLock (default)', async () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(result.current.active).toBe(false);
  });

  it('uses navigator.wakeLock by default', async () => {
    const { wakeLock } = fakeWakeLock();
    vi.stubGlobal('navigator', { wakeLock });
    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current.active).toBe(true));
  });

  it('re-acquires after the browser drops the lock and the page becomes visible', async () => {
    const { wakeLock, sentinels } = fakeWakeLock();
    const doc = fakeDoc();
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc }));
    await waitFor(() => expect(result.current.active).toBe(true));

    doc.visibilityState = 'hidden';
    act(() => sentinels[0].drop());
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.active).toBe(false);
    expect(wakeLock.request).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'visible';
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it('does not double-request while a lock is held', async () => {
    const { wakeLock } = fakeWakeLock();
    const doc = fakeDoc();
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc }));
    await waitFor(() => expect(result.current.active).toBe(true));
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('releases on disable and on unmount', async () => {
    const { wakeLock, sentinels } = fakeWakeLock();
    const doc = fakeDoc();
    const { result, rerender, unmount } = renderHook(
      ({ on }) => useWakeLock(on, { wakeLock, doc }),
      { initialProps: { on: true } },
    );
    await waitFor(() => expect(result.current.active).toBe(true));
    rerender({ on: false });
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBe(false);

    rerender({ on: true });
    await waitFor(() => expect(result.current.active).toBe(true));
    unmount();
    expect(sentinels[1].release).toHaveBeenCalledTimes(1);
  });

  it('stops listening for visibility after disable', async () => {
    const { wakeLock } = fakeWakeLock();
    const doc = fakeDoc();
    const { rerender } = renderHook(({ on }) => useWakeLock(on, { wakeLock, doc }), {
      initialProps: { on: true },
    });
    await act(async () => {});
    rerender({ on: false });
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('releases a lock that resolves after unmount', async () => {
    let resolve!: (s: WakeLockSentinelLike) => void;
    const wakeLock = { request: vi.fn(() => new Promise<WakeLockSentinelLike>((r) => (resolve = r))) };
    const { unmount } = renderHook(() => useWakeLock(true, { wakeLock, doc: fakeDoc() }));
    unmount();
    const late = fakeSentinel();
    await act(async () => resolve(late));
    expect(late.release).toHaveBeenCalledTimes(1);
  });

  it('tolerates a rejected request (e.g. low battery)', async () => {
    const wakeLock = { request: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) };
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc: fakeDoc() }));
    await act(async () => {});
    expect(result.current.active).toBe(false);
  });

  it('tolerates a release that rejects', async () => {
    const { wakeLock, sentinels } = fakeWakeLock();
    const { result, unmount } = renderHook(() => useWakeLock(true, { wakeLock, doc: fakeDoc() }));
    await waitFor(() => expect(result.current.active).toBe(true));
    sentinels[0].release.mockImplementation(() => Promise.reject(new Error('gone')));
    expect(() => unmount()).not.toThrow();
  });
});
