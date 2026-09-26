/** G4-35 item 3: downloadCSV revokes the object URL only after the click, on a deferred (0 ms) timer. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadCSV } from '../csv';

describe('downloadCSV deferred revoke', () => {
  let revoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:w2'), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not revoke synchronously; revokes exactly once after the click when the 0 ms timer fires', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCSV('a,b', 'w2.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    // exactly one pending timer: the revoke
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(0);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:w2');
    expect(click.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0]);
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('a throwing click still removes the anchor and revokes on the deferred timer', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => downloadCSV('a', 'x.csv')).toThrowError('blocked');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(revoke).toHaveBeenCalledWith('blob:w2');
  });
});
