import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadCSV, UTF8_BOM } from '../csv';

class RecordingBlob {
  static last: RecordingBlob | null = null;
  constructor(public parts: unknown[], public options?: { type?: string }) {
    RecordingBlob.last = this;
  }
}

describe('downloadCSV', () => {
  let createSpy: ReturnType<typeof vi.fn>;
  let revokeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    RecordingBlob.last = null;
    vi.stubGlobal('Blob', RecordingBlob);
    createSpy = vi.fn(() => 'blob:mock-url');
    revokeSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createSpy, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeSpy, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prefixes a UTF-8 BOM only in the downloaded blob', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCSV('Date,Weight (kg)', 'ana.csv');

    const blob = RecordingBlob.last;
    expect(blob).not.toBeNull();
    expect(blob?.parts).toEqual([UTF8_BOM, 'Date,Weight (kg)']);
    expect(blob?.options?.type).toBe('text/csv;charset=utf-8;');
    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('sets filename, cleans up the anchor and revokes the URL after dispatch', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCSV('x', 'marko.csv');

    const ctx: unknown = click.mock.contexts[0];
    if (!(ctx instanceof HTMLAnchorElement)) throw new Error('click was not called on an anchor');
    const anchor = ctx;
    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor.download).toBe('marko.csv');
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.isConnected).toBe(false);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('is a no-op without a DOM', () => {
    vi.stubGlobal('document', undefined);
    downloadCSV('x', 'y.csv');
    expect(RecordingBlob.last).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
