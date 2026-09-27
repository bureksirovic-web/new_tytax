import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWakeLock, type WakeLockSentinelLike } from '@/components/workout/runtime/use-wake-lock';

function fakeDoc(state: string) {
  const doc = Object.assign(new EventTarget(), { visibilityState: state });
  return doc as unknown as Document & { visibilityState: string };
}

function sentinel(): WakeLockSentinelLike {
  return { released: false, release: vi.fn(async () => undefined), addEventListener: vi.fn() };
}

describe('useWakeLock retry', () => {
  it('re-acquires when a pending request is refused across hide/show', async () => {
    let reject: (e: Error) => void = () => undefined;
    const request = vi
      .fn<(type: 'screen') => Promise<WakeLockSentinelLike>>()
      .mockImplementationOnce(() => new Promise((_, rj) => (reject = rj)))
      .mockImplementation(async () => sentinel());
    const wakeLock = { request };
    const doc = fakeDoc('visible');
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc }));
    expect(request).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'hidden';
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    doc.visibilityState = 'visible';
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => reject(new Error('NotAllowedError')));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refused request while the page stays hidden', async () => {
    let reject: (e: Error) => void = () => undefined;
    const request = vi
      .fn<(type: 'screen') => Promise<WakeLockSentinelLike>>()
      .mockImplementationOnce(() => new Promise((_, rj) => (reject = rj)))
      .mockImplementation(async () => sentinel());
    const wakeLock = { request };
    const doc = fakeDoc('visible');
    const { result } = renderHook(() => useWakeLock(true, { wakeLock, doc }));
    doc.visibilityState = 'hidden';
    await act(async () => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => reject(new Error('NotAllowedError')));
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBe(false);
  });
});
