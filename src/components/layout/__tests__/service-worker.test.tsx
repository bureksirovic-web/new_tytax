import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const preloadAll = vi.fn(async () => {});
vi.mock('@/lib/catalog', () => ({ catalog: { preloadAll } }));

import { ServiceWorker } from '../service-worker';

interface Posted {
  message: { type: string; urls: string[] };
  port: MessagePort;
}

function installServiceWorker(posted: Posted[]) {
  const active = {
    postMessage: vi.fn((message: Posted['message'], transfer: MessagePort[]) => {
      posted.push({ message, port: transfer[0] });
      // The worker acknowledges on the transferred port.
      transfer[0].postMessage({ type: 'CACHE_URLS_DONE' });
    }),
  };
  const register = vi.fn(async () => ({}));
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, ready: Promise.resolve({ active }) },
  });
  return { register, active };
}

describe('ServiceWorker', () => {
  beforeEach(() => {
    preloadAll.mockClear();
    delete document.documentElement.dataset.swReady;
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { name: `${window.location.origin}/_next/static/chunks/app.js` },
      { name: `${window.location.origin}/api/health` },
      { name: 'https://cdn.example.com/_next/static/chunks/other.js' },
    ] as unknown as PerformanceEntryList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('registers the worker, warms every catalog chunk and hands over same-origin chunks', async () => {
    const posted: Posted[] = [];
    const { register } = installServiceWorker(posted);

    render(<ServiceWorker />);

    await waitFor(() => expect(document.documentElement.dataset.swReady).toBe('1'));
    // Test env is not production: the dev variant keeps chunks network-first.
    expect(register).toHaveBeenCalledWith('/sw.js?dev=1');
    expect(preloadAll).toHaveBeenCalledTimes(1);
    expect(posted).toHaveLength(1);
    expect(posted[0].message.type).toBe('CACHE_URLS');
    // Only the same-origin /_next/static chunk plus the current page; the API and cross-origin URLs are dropped.
    expect(posted[0].message.urls).toEqual([`${window.location.origin}/_next/static/chunks/app.js`, window.location.pathname]);
  });

  it('does nothing without service worker support', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    render(<ServiceWorker />);
    expect(preloadAll).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.swReady).toBeUndefined();
    expect('serviceWorker' in navigator).toBe(false);
  });

  it('logs and stays unready when registration fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn(async () => Promise.reject(new Error('blocked'))), ready: new Promise(() => {}) },
    });
    render(<ServiceWorker />);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(document.documentElement.dataset.swReady).toBeUndefined();
    expect(preloadAll).not.toHaveBeenCalled();
  });
});
